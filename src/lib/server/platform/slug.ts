const REPLACEMENTS: Record<string, string> = { ä: 'a', ö: 'o', å: 'a', ü: 'u', ß: 'ss' };

export function slugify(input: string): string {
	return (
		input
			.toLowerCase()
			.replace(/[äöåüß]/g, (c) => REPLACEMENTS[c])
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80) || 'item'
	);
}

/** Returns `base`, or `base-2`, `base-3`… — the first one `isTaken` says is free. */
export async function uniqueSlug(
	base: string,
	isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
	const root = slugify(base);
	let candidate = root;
	for (let i = 2; await isTaken(candidate); i++) candidate = `${root}-${i}`;
	return candidate;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards database lookups by id against malformed input (which Postgres rejects with an error). */
export const isUuid = (value: unknown): value is string =>
	typeof value === 'string' && UUID.test(value);
