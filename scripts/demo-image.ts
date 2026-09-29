// Generates simple abstract PNG images for demo data (soft gradient + light circles), so the
// seed needs no stock photos with unclear licences. Pure Node: zlib only.

import { crc32, deflateSync } from 'node:zlib';

function chunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

type RGB = [number, number, number];

function hsl(h: number, s: number, l: number): RGB {
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
	};
	return [f(0), f(8), f(4)];
}

/** A 1200×675 PNG in the given hue (0–360). `seed` varies the circles. */
export function demoImage(hue: number, seed: number, width = 1200, height = 675): Buffer {
	const from = hsl(hue, 0.45, 0.42);
	const to = hsl((hue + 40) % 360, 0.55, 0.72);
	let s = seed * 9301 + 49297;
	const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
	const circles = Array.from({ length: 6 }, () => ({
		x: rand() * width,
		y: rand() * height,
		r: 80 + rand() * 260,
		a: 0.08 + rand() * 0.12
	}));

	const raw = Buffer.alloc((width * 3 + 1) * height);
	for (let y = 0; y < height; y++) {
		const row = y * (width * 3 + 1);
		raw[row] = 0; // filter: none
		for (let x = 0; x < width; x++) {
			const t = (x / width) * 0.6 + (y / height) * 0.4;
			let rgb = from.map((c, i) => c + (to[i] - c) * t) as RGB;
			for (const c of circles) {
				const d = Math.hypot(x - c.x, y - c.y);
				if (d < c.r) {
					const k = c.a * (1 - d / c.r);
					rgb = rgb.map((v) => v + (255 - v) * k) as RGB;
				}
			}
			const i = row + 1 + x * 3;
			raw[i] = rgb[0];
			raw[i + 1] = rgb[1];
			raw[i + 2] = rgb[2];
		}
	}

	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8; // bit depth
	header[9] = 2; // colour type: RGB
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(raw, { level: 6 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}
