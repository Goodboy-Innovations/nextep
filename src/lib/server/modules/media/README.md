# media

Uploaded images (event pictures). Stored as `bytea` in `media_assets` for the alpha, so Postgres stays the only store; move to S3-compatible storage when volume requires it (only this module changes).

- Accepted: JPEG, PNG, WebP, detected from the file's first bytes (`detect.ts`). The browser's MIME type is ignored, and SVG is never accepted.
- Max 3 MB. The dashboard downsizes images in the browser before upload when JavaScript is on.
- Served from `/media/{id}` with the exact content type, `nosniff` and a one-year immutable cache (ids never change content).
- Images belong to an organization; events may only use their own organization's images.
