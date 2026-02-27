import { StripResult } from "../types";

/**
 * Strip metadata from a PDF by replacing Info dictionary contents and XMP
 * packets with spaces. This preserves byte offsets so xref tables stay valid.
 */
export function stripPdfMetadata(
	buffer: ArrayBuffer,
	_keepColorProfiles: boolean
): StripResult {
	const data = new Uint8Array(buffer);
	let segmentsRemoved = 0;

	// Minimum viable PDF is at least ~60 bytes; also verify %PDF- header
	if (data.length < 20 || !matchesBytes(data, 0, PERCENT_PDF)) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	// Bail on encrypted PDFs to avoid corruption
	if (containsBytes(data, ENCRYPT_MARKER)) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	// Work on a copy so we don't mutate the original
	const out = new Uint8Array(data);

	// --- 1. Strip XMP metadata packets ---
	segmentsRemoved += stripXmpPackets(out);

	// --- 2. Strip Info dictionary ---
	segmentsRemoved += stripInfoDict(out);

	if (segmentsRemoved === 0) {
		return { stripped: false, data: buffer, segmentsRemoved: 0 };
	}

	return {
		stripped: true,
		data: out.buffer,
		segmentsRemoved,
	};
}

// --- Byte patterns ---
const PERCENT_PDF = toBytes("%PDF-");
const ENCRYPT_MARKER = toBytes("/Encrypt");
const XPACKET_BEGIN = toBytes("<?xpacket begin");
const XPACKET_END_PREFIX = toBytes("<?xpacket end");
const TRAILER = toBytes("trailer");
const INFO_SLASH = toBytes("/Info");
const DICT_OPEN = toBytes("<<");
const ENDOBJ = toBytes("endobj");

// --- XMP packet stripping ---

function stripXmpPackets(data: Uint8Array): number {
	let count = 0;
	let pos = 0;

	while (pos < data.length) {
		const beginIdx = indexOf(data, XPACKET_BEGIN, pos);
		if (beginIdx === -1) break;

		// Find the end marker after this begin marker
		const endIdx = indexOf(data, XPACKET_END_PREFIX, beginIdx);
		if (endIdx === -1) break;

		// Find the closing ?> of the end packet
		const closeIdx = indexOf(data, toBytes("?>"), endIdx);
		if (closeIdx === -1) break;

		const rangeEnd = closeIdx + 2;

		// Replace entire packet with spaces
		fillSpaces(data, beginIdx, rangeEnd);
		count++;

		pos = rangeEnd;
	}

	return count;
}

// --- Info dictionary stripping ---

function stripInfoDict(data: Uint8Array): number {
	// Search backward from EOF for "trailer"
	const trailerIdx = lastIndexOf(data, TRAILER);
	if (trailerIdx === -1) return 0;

	// Find /Info reference in trailer section
	const infoIdx = indexOf(data, INFO_SLASH, trailerIdx);
	if (infoIdx === -1) return 0;

	// Parse the object reference: /Info X Y R
	const refStart = infoIdx + INFO_SLASH.length;
	const ref = parseObjRef(data, refStart);
	if (!ref) return 0;

	// Find the object "X Y obj"
	const objHeader = toBytes(`${ref.objNum} ${ref.genNum} obj`);
	const objIdx = indexOf(data, objHeader, 0);
	if (objIdx === -1) return 0;

	// Find << and >> within this object
	const objKeywordEnd = objIdx + objHeader.length;
	const dictStart = indexOf(data, DICT_OPEN, objKeywordEnd);
	if (dictStart === -1) return 0;

	// Find the matching >> (handle nested dicts by counting depth)
	const dictEnd = findMatchingDictClose(data, dictStart);
	if (dictEnd === -1) return 0;

	// Verify endobj follows reasonably soon
	const endobjIdx = indexOf(data, ENDOBJ, dictEnd);
	if (endobjIdx === -1 || endobjIdx - dictEnd > 20) return 0;

	// Replace contents between << and >> (exclusive) with spaces
	const contentStart = dictStart + 2;
	const contentEnd = dictEnd;
	if (contentEnd <= contentStart) return 0;

	fillSpaces(data, contentStart, contentEnd);
	return 1;
}

function findMatchingDictClose(data: Uint8Array, openPos: number): number {
	let depth = 0;
	let pos = openPos;

	while (pos + 1 < data.length) {
		if (data[pos] === 0x3c && data[pos + 1] === 0x3c) {
			// <<
			depth++;
			pos += 2;
		} else if (data[pos] === 0x3e && data[pos + 1] === 0x3e) {
			// >>
			depth--;
			if (depth === 0) return pos;
			pos += 2;
		} else {
			pos++;
		}
	}

	return -1;
}

// --- Object reference parsing ---

interface ObjRef {
	objNum: number;
	genNum: number;
}

function parseObjRef(data: Uint8Array, start: number): ObjRef | null {
	// Skip whitespace
	let pos = start;
	while (pos < data.length && isWhitespace(data[pos])) pos++;

	// Read object number
	const objNumStart = pos;
	while (pos < data.length && isDigit(data[pos])) pos++;
	if (pos === objNumStart) return null;
	const objNum = parseInt(
		String.fromCharCode(...data.slice(objNumStart, pos)),
		10
	);

	// Skip whitespace
	while (pos < data.length && isWhitespace(data[pos])) pos++;

	// Read generation number
	const genNumStart = pos;
	while (pos < data.length && isDigit(data[pos])) pos++;
	if (pos === genNumStart) return null;
	const genNum = parseInt(
		String.fromCharCode(...data.slice(genNumStart, pos)),
		10
	);

	// Skip whitespace and expect 'R'
	while (pos < data.length && isWhitespace(data[pos])) pos++;
	if (pos >= data.length || data[pos] !== 0x52) return null; // 'R'

	return { objNum, genNum };
}

// --- Utility functions ---

function toBytes(str: string): Uint8Array {
	const arr = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) {
		arr[i] = str.charCodeAt(i);
	}
	return arr;
}

function matchesBytes(
	data: Uint8Array,
	offset: number,
	pattern: Uint8Array
): boolean {
	if (offset + pattern.length > data.length) return false;
	for (let i = 0; i < pattern.length; i++) {
		if (data[offset + i] !== pattern[i]) return false;
	}
	return true;
}

function indexOf(
	data: Uint8Array,
	pattern: Uint8Array,
	from: number
): number {
	const limit = data.length - pattern.length;
	for (let i = from; i <= limit; i++) {
		if (matchesBytes(data, i, pattern)) return i;
	}
	return -1;
}

function lastIndexOf(data: Uint8Array, pattern: Uint8Array): number {
	for (let i = data.length - pattern.length; i >= 0; i--) {
		if (matchesBytes(data, i, pattern)) return i;
	}
	return -1;
}

function containsBytes(data: Uint8Array, pattern: Uint8Array): boolean {
	return indexOf(data, pattern, 0) !== -1;
}

function fillSpaces(data: Uint8Array, start: number, end: number): void {
	for (let i = start; i < end; i++) {
		data[i] = 0x20; // space
	}
}

function isWhitespace(byte: number): boolean {
	return (
		byte === 0x20 ||
		byte === 0x09 ||
		byte === 0x0a ||
		byte === 0x0d
	);
}

function isDigit(byte: number): boolean {
	return byte >= 0x30 && byte <= 0x39;
}
