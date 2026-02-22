import { StripResult } from "../types";
import { readUint16BE, matchesAscii } from "../utils";

const ICC_PROFILE_SIG = "ICC_PROFILE\0";

export function stripJpegMetadata(
	buffer: ArrayBuffer,
	keepColorProfiles: boolean
): StripResult {
	const src = new Uint8Array(buffer);
	let segmentsRemoved = 0;

	// Validate SOI marker
	if (src.length < 2 || src[0] !== 0xff || src[1] !== 0xd8) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	const out = new Uint8Array(src.length);
	let outPos = 0;

	// Copy SOI
	out[outPos++] = 0xff;
	out[outPos++] = 0xd8;

	let pos = 2;

	while (pos < src.length) {
		// Find marker
		if (src[pos] !== 0xff) {
			// Not a valid marker position — bail, return original
			return { stripped: false, data: buffer, segmentsRemoved: 0 };
		}

		// Skip fill bytes (consecutive 0xFF)
		while (pos < src.length - 1 && src[pos + 1] === 0xff) {
			pos++;
		}

		if (pos + 1 >= src.length) {
			return { stripped: false, data: buffer, segmentsRemoved: 0 };
		}

		const marker = src[pos + 1];

		// EOI marker
		if (marker === 0xd9) {
			out[outPos++] = 0xff;
			out[outPos++] = 0xd9;
			break;
		}

		// SOS marker — copy header then entropy-coded data
		if (marker === 0xda) {
			if (pos + 3 >= src.length) {
				return { stripped: false, data: buffer, segmentsRemoved: 0 };
			}

			const sosLen = readUint16BE(src, pos + 2);

			if (pos + 2 + sosLen > src.length) {
				return { stripped: false, data: buffer, segmentsRemoved: 0 };
			}

			// Copy SOS marker + header
			for (let i = 0; i < 2 + sosLen; i++) {
				out[outPos++] = src[pos + i];
			}
			pos += 2 + sosLen;

			// Copy entropy-coded data until next real marker
			while (pos < src.length) {
				if (src[pos] === 0xff) {
					if (pos + 1 >= src.length) {
						out[outPos++] = src[pos++];
						break;
					}

					const next = src[pos + 1];

					// Byte-stuffed 0x00 — copy both bytes
					if (next === 0x00) {
						out[outPos++] = src[pos++];
						out[outPos++] = src[pos++];
						continue;
					}

					// RST markers (0xD0–0xD7) — copy and continue
					if (next >= 0xd0 && next <= 0xd7) {
						out[outPos++] = src[pos++];
						out[outPos++] = src[pos++];
						continue;
					}

					// Fill bytes (0xFF) — skip
					if (next === 0xff) {
						out[outPos++] = src[pos++];
						continue;
					}

					// Real marker found — break to outer loop
					break;
				} else {
					out[outPos++] = src[pos++];
				}
			}
			continue;
		}

		// Standalone markers (no length field): TEM, RST0-RST7
		if (
			marker === 0x01 ||
			(marker >= 0xd0 && marker <= 0xd7)
		) {
			out[outPos++] = 0xff;
			out[outPos++] = marker;
			pos += 2;
			continue;
		}

		// All other markers have a length field
		if (pos + 3 >= src.length) {
			return { stripped: false, data: buffer, segmentsRemoved: 0 };
		}

		const segLen = readUint16BE(src, pos + 2);

		if (segLen < 2 || pos + 2 + segLen > src.length) {
			return { stripped: false, data: buffer, segmentsRemoved: 0 };
		}

		const totalSegSize = 2 + segLen; // marker (2) + length field + data

		if (shouldRemoveMarker(marker, src, pos, keepColorProfiles)) {
			segmentsRemoved++;
			pos += totalSegSize;
			continue;
		}

		// Keep this segment
		for (let i = 0; i < totalSegSize; i++) {
			out[outPos++] = src[pos + i];
		}
		pos += totalSegSize;
	}

	if (segmentsRemoved === 0) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	return {
		stripped: true,
		data: out.buffer.slice(0, outPos),
		segmentsRemoved,
	};
}

function shouldRemoveMarker(
	marker: number,
	src: Uint8Array,
	pos: number,
	keepColorProfiles: boolean
): boolean {
	// APP1 (0xE1) — EXIF, XMP
	// APP2 (0xE2) — ICC profile (conditionally keep)
	// APP3–APP12 (0xE3–0xEC)
	// APP13 (0xED) — IPTC/Photoshop
	// APP14 (0xEE) — Adobe
	// APP15 (0xEF)
	// COM (0xFE)

	// COM marker — always remove
	if (marker === 0xfe) {
		return true;
	}

	// APP1–APP15 range
	if (marker >= 0xe1 && marker <= 0xef) {
		// APP2 with ICC_PROFILE — conditionally keep
		if (marker === 0xe2 && keepColorProfiles) {
			const dataStart = pos + 4; // after marker + length
			if (
				dataStart + ICC_PROFILE_SIG.length <= src.length &&
				matchesAscii(src, dataStart, ICC_PROFILE_SIG)
			) {
				return false; // Keep ICC profile
			}
		}
		return true;
	}

	return false;
}
