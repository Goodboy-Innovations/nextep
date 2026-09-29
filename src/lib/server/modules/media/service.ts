import { and, eq } from 'drizzle-orm';
import { db, isUuid } from '$lib/server/platform';
import { MAX_IMAGE_BYTES, detectImageType } from './detect';
import { mediaAssets } from './schema';

export type SaveImageResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveImage(orgId: string, bytes: Uint8Array): Promise<SaveImageResult> {
	if (bytes.byteLength === 0) return { ok: false, error: 'Tyhjä tiedosto' };
	if (bytes.byteLength > MAX_IMAGE_BYTES) {
		return { ok: false, error: 'Kuva on liian suuri (enintään 3 Mt)' };
	}
	const contentType = detectImageType(bytes);
	if (!contentType) return { ok: false, error: 'Kuvan pitää olla JPEG, PNG tai WebP' };
	const [row] = await db
		.insert(mediaAssets)
		.values({ orgId, contentType, byteSize: bytes.byteLength, data: Buffer.from(bytes) })
		.returning({ id: mediaAssets.id });
	return { ok: true, id: row.id };
}

export async function getImage(id: string): Promise<{ contentType: string; data: Buffer } | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({ contentType: mediaAssets.contentType, data: mediaAssets.data })
		.from(mediaAssets)
		.where(eq(mediaAssets.id, id));
	return row ?? null;
}

/** True if the image exists and belongs to the organization. */
export async function imageBelongsTo(id: string, orgId: string): Promise<boolean> {
	if (!isUuid(id)) return false;
	const [row] = await db
		.select({ id: mediaAssets.id })
		.from(mediaAssets)
		.where(and(eq(mediaAssets.id, id), eq(mediaAssets.orgId, orgId)));
	return !!row;
}

export async function deleteImage(id: string, orgId: string): Promise<void> {
	if (!isUuid(id)) return;
	await db.delete(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.orgId, orgId)));
}

export const imageUrl = (id: string | null) => (id ? `/media/${id}` : null);
