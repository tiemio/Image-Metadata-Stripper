import { StripResult } from "../types";
import { readUint32BE, matchesAscii } from "../utils";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const METADATA_CHUNKS = ["tEXt", "zTXt", "iTXt", "eXIf", "tIME"];
const COLOR_CHUNKS = ["iCCP", "sRGB", "gAMA", "cHRM"];

export function stripPngMetadata(
	buffer: ArrayBuffer,
	keepColorProfiles: boolean
): StripResult {
	const src = new Uint8Array(buffer);
	let segmentsRemoved = 0;

	// Validate PNG signature (8 bytes)
	if (src.length < 8) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	for (let i = 0; i < 8; i++) {
		if (src[i] !== PNG_SIGNATURE[i]) {
			return { stripped: false, data: buffer, segmentsRemoved: 0 };
		}
	}

	const out = new Uint8Array(src.length);
	let outPos = 0;

	// Copy PNG signature
	for (let i = 0; i < 8; i++) {
		out[outPos++] = src[i];
	}

	let pos = 8;

	while (pos + 12 <= src.length) {
		// Each chunk: 4-byte length + 4-byte type + data + 4-byte CRC
		const chunkDataLen = readUint32BE(src, pos);
		const totalChunkSize = 12 + chunkDataLen; // length(4) + type(4) + data + CRC(4)

		if (pos + totalChunkSize > src.length) {
			// Truncated chunk — bail, return original
			return { stripped: false, data: buffer, segmentsRemoved: 0 };
		}

		// Read chunk type (4 bytes at pos+4)
		const chunkType = String.fromCharCode(
			src[pos + 4],
			src[pos + 5],
			src[pos + 6],
			src[pos + 7]
		);

		let remove = false;

		if (METADATA_CHUNKS.indexOf(chunkType) !== -1) {
			remove = true;
		} else if (!keepColorProfiles && COLOR_CHUNKS.indexOf(chunkType) !== -1) {
			remove = true;
		}

		if (remove) {
			segmentsRemoved++;
		} else {
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

	return {
		stripped: true,
		data: out.buffer.slice(0, outPos),
		segmentsRemoved,
	};
}
