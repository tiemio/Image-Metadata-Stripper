export function readUint16BE(data: Uint8Array, offset: number): number {
	return (data[offset] << 8) | data[offset + 1];
}

export function readUint32BE(data: Uint8Array, offset: number): number {
	return (
		((data[offset] << 24) |
			(data[offset + 1] << 16) |
			(data[offset + 2] << 8) |
			data[offset + 3]) >>>
		0
	);
}

export function readUint32LE(data: Uint8Array, offset: number): number {
	return (
		(data[offset] |
			(data[offset + 1] << 8) |
			(data[offset + 2] << 16) |
			(data[offset + 3] << 24)) >>>
		0
	);
}

export function writeUint32LE(
	data: Uint8Array,
	offset: number,
	value: number
): void {
	data[offset] = value & 0xff;
	data[offset + 1] = (value >> 8) & 0xff;
	data[offset + 2] = (value >> 16) & 0xff;
	data[offset + 3] = (value >> 24) & 0xff;
}

export function matchesAscii(
	data: Uint8Array,
	offset: number,
	str: string
): boolean {
	for (let i = 0; i < str.length; i++) {
		if (offset + i >= data.length) return false;
		if (data[offset + i] !== str.charCodeAt(i)) return false;
	}
	return true;
}
