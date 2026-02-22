import { StripResult } from "../types";
import { readUint32LE, writeUint32LE, matchesAscii } from "../utils";

export function stripWebpMetadata(
	buffer: ArrayBuffer,
	keepColorProfiles: boolean
): StripResult {
	const src = new Uint8Array(buffer);
	let segmentsRemoved = 0;

	// Validate RIFF....WEBP header (minimum 12 bytes)
	if (src.length < 12) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	if (
		!matchesAscii(src, 0, "RIFF") ||
		!matchesAscii(src, 8, "WEBP")
	) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	const out = new Uint8Array(src.length);
	let outPos = 0;

	// Copy RIFF header (12 bytes: "RIFF" + size + "WEBP")
	for (let i = 0; i < 12; i++) {
		out[outPos++] = src[i];
	}

	let pos = 12;
	let vp8xOffset = -1;
	let hadExif = false;
	let hadXmp = false;
	let hadIccp = false;

	while (pos + 8 <= src.length) {
		// FourCC (4 bytes) + size (4 bytes LE) + data
		const fourCC = String.fromCharCode(
			src[pos],
			src[pos + 1],
			src[pos + 2],
			src[pos + 3]
		);
		const chunkSize = readUint32LE(src, pos + 4);
		// Chunks are padded to even size
		const paddedSize = chunkSize + (chunkSize % 2);
		const totalChunkSize = 8 + paddedSize;

		if (pos + 8 + paddedSize > src.length) {
			// Truncated chunk — bail, return original buffer untouched
			// (consistent with JPEG/PNG parsers; prevents metadata bypass
			// via inflated chunk size)
			return { stripped: false, data: buffer, segmentsRemoved: 0 };
		}

		let remove = false;

		if (fourCC === "EXIF") {
			remove = true;
			hadExif = true;
		} else if (fourCC === "XMP ") {
			remove = true;
			hadXmp = true;
		} else if (fourCC === "ICCP") {
			if (!keepColorProfiles) {
				remove = true;
				hadIccp = true;
			}
		}

		if (remove) {
			segmentsRemoved++;
		} else {
			// Track VP8X position in output for flag patching
			if (fourCC === "VP8X") {
				vp8xOffset = outPos;
			}

			// Copy entire chunk
			for (let i = 0; i < totalChunkSize; i++) {
				out[outPos++] = src[pos + i];
			}
		}

		pos += totalChunkSize;
	}

	if (segmentsRemoved === 0) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	// Patch RIFF file size (bytes 4–7): total file size minus 8
	const newRiffSize = outPos - 8;
	writeUint32LE(out, 4, newRiffSize);

	// Patch VP8X flags if present
	if (vp8xOffset !== -1 && vp8xOffset + 18 <= outPos) {
		// VP8X flags byte is at offset +8 within the chunk (after FourCC + size)
		const flagsOffset = vp8xOffset + 8;
		let flags = out[flagsOffset];

		if (hadExif) {
			flags &= ~(1 << 3); // Clear EXIF flag (bit 3)
		}
		if (hadXmp) {
			flags &= ~(1 << 2); // Clear XMP flag (bit 2)
		}
		if (hadIccp) {
			flags &= ~(1 << 5); // Clear ICC flag (bit 5)
		}

		out[flagsOffset] = flags;
	}

	return {
		stripped: true,
		data: out.buffer.slice(0, outPos),
		segmentsRemoved,
	};
}
