export interface ImageMetadataStripperSettings {
	enabled: boolean;
	stripJpeg: boolean;
	stripPng: boolean;
	stripWebp: boolean;
	stripPdf: boolean;
	keepColorProfiles: boolean;
	showNotifications: boolean;
}

export const DEFAULT_SETTINGS: ImageMetadataStripperSettings = {
	enabled: true,
	stripJpeg: true,
	stripPng: true,
	stripWebp: true,
	stripPdf: true,
	keepColorProfiles: true,
	showNotifications: true,
};

export interface StripResult {
	stripped: boolean;
	data: ArrayBuffer;
	segmentsRemoved: number;
}
