// Identifies image types by their first bytes. The browser-reported MIME type is never trusted,
// and SVG is never accepted (it can carry scripts and would be served from our own origin).

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export function detectImageType(bytes: Uint8Array): ImageType | null {
	const at = (offset: number, ...values: number[]) =>
		values.every((v, i) => bytes[offset + i] === v);
	if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
	// "RIFF" .... "WEBP"
	if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
	return null;
}
