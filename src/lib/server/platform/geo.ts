// v0.1 has no external geocoder: locations resolve to a city centre unless exact
// coordinates are given. A real geocoding adapter can replace `cityCoordinates` later.

export interface City {
	name: string;
	lat: number;
	lng: number;
}

export const CITIES: City[] = [
	{ name: 'Espoo', lat: 60.2055, lng: 24.6559 },
	{ name: 'Helsinki', lat: 60.1699, lng: 24.9384 },
	{ name: 'Hämeenlinna', lat: 60.9959, lng: 24.4643 },
	{ name: 'Joensuu', lat: 62.601, lng: 29.7636 },
	{ name: 'Jyväskylä', lat: 62.2426, lng: 25.7473 },
	{ name: 'Kajaani', lat: 64.2273, lng: 27.7285 },
	{ name: 'Kokkola', lat: 63.8385, lng: 23.1307 },
	{ name: 'Kotka', lat: 60.4664, lng: 26.9458 },
	{ name: 'Kuopio', lat: 62.8924, lng: 27.677 },
	{ name: 'Lahti', lat: 60.9827, lng: 25.6612 },
	{ name: 'Lappeenranta', lat: 61.0587, lng: 28.1887 },
	{ name: 'Mikkeli', lat: 61.6886, lng: 27.2723 },
	{ name: 'Oulu', lat: 65.0121, lng: 25.4651 },
	{ name: 'Pori', lat: 61.4851, lng: 21.7974 },
	{ name: 'Porvoo', lat: 60.3932, lng: 25.6651 },
	{ name: 'Rovaniemi', lat: 66.5039, lng: 25.7294 },
	{ name: 'Salo', lat: 60.3833, lng: 23.1333 },
	{ name: 'Seinäjoki', lat: 62.7903, lng: 22.8403 },
	{ name: 'Tampere', lat: 61.4978, lng: 23.761 },
	{ name: 'Turku', lat: 60.4518, lng: 22.2666 },
	{ name: 'Vaasa', lat: 63.0951, lng: 21.6165 },
	{ name: 'Vantaa', lat: 60.2934, lng: 25.0378 }
];

export function findCity(name: string | null | undefined): City | undefined {
	if (!name) return undefined;
	const needle = name.trim().toLowerCase();
	return CITIES.find((c) => c.name.toLowerCase() === needle);
}

/** The listed city closest to a point (good enough at Finnish distances). */
export function nearestCity(lat: number, lng: number): City {
	const distance = (c: City) =>
		(c.lat - lat) ** 2 + ((c.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
	return CITIES.reduce((best, c) => (distance(c) < distance(best) ? c : best));
}

/** Rounds coordinates to ~1 km so seeker locations are never stored precisely. */
export function coarse(value: number): number {
	return Math.round(value * 100) / 100;
}
