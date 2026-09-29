import { describe, expect, it } from 'vitest';
import { detectImageType } from './detect';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('detectImageType', () => {
	it('recognizes JPEG, PNG and WebP', () => {
		expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
		expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
			'image/png'
		);
		const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
		expect(detectImageType(webp)).toBe('image/webp');
	});

	it('rejects SVG and HTML even when named like an image', () => {
		expect(
			detectImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))
		).toBeNull();
		expect(detectImageType(new TextEncoder().encode('<!doctype html><script>'))).toBeNull();
		expect(detectImageType(bytes())).toBeNull();
	});
});
