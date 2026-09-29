/**
 * Ranking weights. See docs/proposal.md §5.3 and the golden scenarios in ranking.test.ts.
 *
 * score = time · e^(−|Δt| / τ_time) + distance · e^(−km / τ_km) + preference · matched/chosen + text · relevance
 */
export const RANKING = {
	weights: { time: 1.0, distance: 1.0, preference: 0.6, text: 1.5 },
	/** Time falloff in days. */
	tauTimeDays: 7,
	/** Distance falloff in km. */
	tauDistanceKm: 10,
	/** Default hard distance cap in km; null means "anywhere". */
	defaultMaxKm: 60,
	/** Minimum trigram word similarity for a fuzzy title/organization match. */
	minSimilarity: 0.4,
	pageSize: 24
} as const;

export const DISTANCE_OPTIONS = [10, 30, 60, 150] as const;
