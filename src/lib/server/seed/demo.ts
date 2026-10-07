// Demo data: taxonomies, fictional organizations and events, an admin and an organizer account.
// Used by `npm run db:seed` (scripts/seed.ts) and, with SEED_ON_START=1, at server start.
//
// All organizations here are fictional.

import { slugify, sql } from '$lib/server/platform';
import { saveImage } from '$lib/server/modules/media';
import { createUser } from '$lib/server/modules/identity';
import { addMember, createOrganization } from '$lib/server/modules/organizations';
import { listTerms, upsertTerm, type TaxonomyKind } from '$lib/server/modules/taxonomy';
import { createEvent, hasEvents, setEventImage, type EventInput } from '$lib/server/modules/events';
import { demoImage } from './demo-image';

const TERMS: Record<TaxonomyKind, [slug: string, fi: string, en: string][]> = {
	category: [
		['worship', 'Jumalanpalvelus', 'Worship service'],
		['prayer', 'Rukous', 'Prayer'],
		['music', 'Musiikki ja ylistys', 'Music & worship'],
		['bible-study', 'Raamattupiiri', 'Bible study'],
		['community', 'Yhteisö', 'Community'],
		['youth-night', 'Nuorten ilta', 'Youth night']
	],
	age_group: [
		['children', 'Lapset', 'Children'],
		['youth', 'Nuoret', 'Youth'],
		['young-adults', 'Nuoret aikuiset', 'Young adults'],
		['adults', 'Aikuiset', 'Adults']
	],
	language: [
		['fi', 'Suomi', 'Finnish'],
		['en', 'Englanti', 'English'],
		['sv', 'Ruotsi', 'Swedish'],
		['ru', 'Venäjä', 'Russian'],
		['es', 'Espanja', 'Spanish'],
		['ar', 'Arabia', 'Arabic'],
		['de', 'Saksa', 'German']
	],
	denomination: [
		['lutheran', 'Luterilainen', 'Lutheran'],
		['pentecostal', 'Helluntai', 'Pentecostal'],
		['free-church', 'Vapaakirkko', 'Free Church'],
		['orthodox', 'Ortodoksinen', 'Orthodox'],
		['catholic', 'Katolinen', 'Catholic'],
		['ecumenical', 'Ekumeeninen', 'Ecumenical']
	]
};

interface SeedEvent {
	title: string;
	extract: string;
	weekday?: number; // 0 = Sunday … 6 = Saturday; recurring weekly when set
	inDays?: number; // one-off: days from today
	start: string;
	end: string;
	venue: string;
	terms: string[]; // "kind:slug"
}

interface SeedOrg {
	name: string;
	city: string;
	description: string;
	denomination: string;
	events: SeedEvent[];
}

const ORGS: SeedOrg[] = [
	{
		name: 'Toivon seurakunta',
		city: 'Helsinki',
		denomination: 'lutheran',
		description: 'Demo-organisaatio. Keskustan seurakunta, jossa kaikki ovat tervetulleita.',
		events: [
			{
				title: 'Sunnuntain messu',
				extract: 'Messu, pyhäkoulu ja kirkkokahvit.',
				weekday: 0,
				start: '11:00',
				end: '12:30',
				venue: 'Toivon kirkko',
				terms: ['category:worship', 'age_group:adults', 'age_group:children', 'language:fi']
			},
			{
				title: 'Taizé-rukoushetki',
				extract: 'Hiljaisuutta, laulua ja kynttilöitä.',
				weekday: 3,
				start: '18:30',
				end: '19:30',
				venue: 'Toivon kirkon kappeli',
				terms: ['category:prayer', 'category:music', 'language:fi']
			},
			{
				title: 'Gospel-konsertti',
				extract: 'Syksyn gospelkonsertti, vapaa pääsy.',
				inDays: 9,
				start: '19:00',
				end: '21:00',
				venue: 'Toivon kirkko',
				terms: ['category:music', 'age_group:young-adults', 'age_group:adults', 'language:fi']
			}
		]
	},
	{
		name: 'Kaupunkikirkko Nousu',
		city: 'Helsinki',
		denomination: 'free-church',
		description: 'Demo-organisaatio. Nuorten aikuisten yhteisö Kalliossa.',
		events: [
			{
				title: 'Nousu Sunday',
				extract: 'Ylistystä, opetusta ja yhteyttä suomeksi ja englanniksi.',
				weekday: 0,
				start: '17:00',
				end: '19:00',
				venue: 'Kulttuurisali',
				terms: [
					'category:worship',
					'category:music',
					'age_group:young-adults',
					'language:fi',
					'language:en'
				]
			},
			{
				title: 'Nuorten ilta',
				extract: 'Pelejä, iltapala ja lyhyt puhe.',
				weekday: 5,
				start: '18:00',
				end: '21:00',
				venue: 'Nousun nuorisotila',
				terms: ['category:youth-night', 'age_group:youth', 'language:fi']
			}
		]
	},
	{
		name: 'Espoon kansainvälinen yhteisö',
		city: 'Espoo',
		denomination: 'ecumenical',
		description: 'Demo organization. An English-speaking international congregation.',
		events: [
			{
				title: 'International Service',
				extract: 'English-language service with kids’ programme.',
				weekday: 0,
				start: '14:00',
				end: '15:30',
				venue: 'Community Hall',
				terms: ['category:worship', 'age_group:adults', 'age_group:children', 'language:en']
			},
			{
				title: 'Bible Study in English',
				extract: 'Small group reading the Gospel of John.',
				weekday: 2,
				start: '18:00',
				end: '19:30',
				venue: 'Community Hall',
				terms: ['category:bible-study', 'age_group:young-adults', 'age_group:adults', 'language:en']
			}
		]
	},
	{
		name: 'Vantaan helluntaiseurakunta Sillat',
		city: 'Vantaa',
		denomination: 'pentecostal',
		description: 'Demo-organisaatio. Monikielinen helluntaiseurakunta.',
		events: [
			{
				title: 'Sunnuntain jumalanpalvelus',
				extract: 'Ylistystä ja julistusta, tulkkaus venäjäksi.',
				weekday: 0,
				start: '11:00',
				end: '12:30',
				venue: 'Sillat-keskus',
				terms: [
					'category:worship',
					'category:music',
					'age_group:adults',
					'language:fi',
					'language:ru'
				]
			},
			{
				title: 'Rukousilta',
				extract: 'Yhteistä rukousta kaupungin puolesta.',
				weekday: 4,
				start: '18:00',
				end: '19:30',
				venue: 'Sillat-keskus',
				terms: ['category:prayer', 'age_group:adults', 'language:fi']
			}
		]
	},
	{
		name: 'Tampereen Valon yhteisö',
		city: 'Tampere',
		denomination: 'free-church',
		description: 'Demo-organisaatio. Kotiryhmiä ja ylistysiltoja Tampereella.',
		events: [
			{
				title: 'Ylistysilta',
				extract: 'Bändi, ylistystä ja rukousta.',
				weekday: 6,
				start: '18:00',
				end: '20:00',
				venue: 'Valon sali',
				terms: ['category:music', 'category:prayer', 'age_group:young-adults', 'language:fi']
			},
			{
				title: 'Perhekirkko',
				extract: 'Lapsiystävällinen jumalanpalvelus.',
				weekday: 0,
				start: '10:00',
				end: '11:00',
				venue: 'Valon sali',
				terms: ['category:worship', 'age_group:children', 'language:fi']
			},
			{
				title: 'Syysleiri-info',
				extract: 'Kaikki nuorten syysleiristä.',
				inDays: 4,
				start: '17:30',
				end: '18:30',
				venue: 'Valon sali',
				terms: ['category:community', 'age_group:youth', 'language:fi']
			}
		]
	},
	{
		name: 'Turun ortodoksinen yhteisö Pyhä Valo',
		city: 'Turku',
		denomination: 'orthodox',
		description: 'Demo-organisaatio.',
		events: [
			{
				title: 'Liturgia',
				extract: 'Sunnuntain liturgia suomeksi ja kirkkoslaaviksi.',
				weekday: 0,
				start: '10:00',
				end: '12:00',
				venue: 'Pyhän Valon kirkko',
				terms: ['category:worship', 'age_group:adults', 'language:fi', 'language:ru']
			},
			{
				title: 'Vigilia',
				extract: 'Lauantai-illan vigilia.',
				weekday: 6,
				start: '17:00',
				end: '18:30',
				venue: 'Pyhän Valon kirkko',
				terms: ['category:worship', 'category:prayer', 'language:fi']
			}
		]
	},
	{
		name: 'Oulun Kohtaamo',
		city: 'Oulu',
		denomination: 'lutheran',
		description: 'Demo-organisaatio. Kohtaamispaikka opiskelijoille.',
		events: [
			{
				title: 'Opiskelijailta',
				extract: 'Iltapala, keskustelua ja rukousta.',
				weekday: 2,
				start: '18:00',
				end: '20:30',
				venue: 'Kohtaamo',
				terms: ['category:community', 'age_group:young-adults', 'language:fi', 'language:en']
			},
			{
				title: 'Hiljaisuuden päivä',
				extract: 'Retriittipäivä kaupungin keskellä.',
				inDays: 12,
				start: '10:00',
				end: '16:00',
				venue: 'Kohtaamo',
				terms: ['category:prayer', 'age_group:adults', 'language:fi']
			}
		]
	},
	{
		name: 'Jyväskylän katolinen seurakunta (demo)',
		city: 'Jyväskylä',
		denomination: 'catholic',
		description: 'Demo-organisaatio.',
		events: [
			{
				title: 'Messu',
				extract: 'Sunnuntain messu suomeksi.',
				weekday: 0,
				start: '12:00',
				end: '13:00',
				venue: 'Seurakuntakeskus',
				terms: ['category:worship', 'age_group:adults', 'language:fi']
			},
			{
				title: 'Misa en español',
				extract: 'Kuukausittainen messu espanjaksi.',
				inDays: 6,
				start: '16:00',
				end: '17:00',
				venue: 'Seurakuntakeskus',
				terms: ['category:worship', 'language:es']
			}
		]
	}
];

/** Next date (yyyy-mm-dd) with the given weekday, today included. */
function nextWeekday(weekday: number): string {
	const d = new Date();
	d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
	return d.toISOString().slice(0, 10);
}

function inDays(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function longDescription(extract: string, title: string, venue: string, city: string) {
	return [
		extract,
		`${title} järjestetään paikassa ${venue}, ${city}. Tilaisuus on avoin kaikille, eikä ennakkoilmoittautumista tarvita. Paikalla on vapaaehtoisia, jotka auttavat alkuun ja vastaavat kysymyksiin. Lämpimästi tervetuloa — ota myös ystäväsi mukaan!`,
		'Tämä on demotapahtuma Nextepin kehitysympäristöä varten.'
	].join('\n\n');
}

/**
 * Gives demo events images and long descriptions, so they qualify for the front page.
 * The first organization gets more than its front-page limit, to show the limit at work.
 * Idempotent: only fills in what is missing, so it can run on an existing database.
 */
async function enrichDemo() {
	let images = 0;
	for (const [orgIndex, seed] of ORGS.entries()) {
		const [org] = await sql<
			{ id: string }[]
		>`select id from organizations where slug = ${slugify(seed.name)}`;
		if (!org) continue;
		const rows = await sql<
			{ id: string; title: string; imageId: string | null; venue: string | null; extract: string }[]
		>`
			select id, title, image_id as "imageId", venue_name as venue, extract
			from events where org_id = ${org.id} and status = 'published' order by created_at`;
		for (const [i, ev] of rows.entries()) {
			if (i >= (orgIndex === 0 ? 7 : 2)) break;
			await sql`
				update events set description = ${longDescription(ev.extract, ev.title, ev.venue ?? seed.name, seed.city)}
				where id = ${ev.id} and char_length(btrim(description)) < 200`;
			if (!ev.imageId) {
				const saved = await saveImage(
					org.id,
					demoImage((orgIndex * 47 + i * 23) % 360, orgIndex * 10 + i)
				);
				if (saved.ok) {
					await setEventImage(org.id, ev.id, saved.id);
					images++;
				}
			}
		}
	}
	console.log(`Demo enrichment: ${images} images added.`);
}

export interface DemoLogin {
	email: string;
	password: string;
}

/** The logins printed by `npm run db:seed`. Fine on a computer, never on a public server. */
export const LOCAL_DEMO_ADMIN: DemoLogin = { email: 'admin@example.com', password: 'nextep-admin' };
const LOCAL_DEMO_ORGANIZER_PASSWORD = 'nextep-demo';

/**
 * For `npm run db:seed`: fills an empty database with demo data and the local demo logins.
 * A database with events only gets missing demo images; `reset` wipes it first.
 */
export async function seedDemo({ reset = false } = {}) {
	if (reset) {
		console.log('Resetting data…');
		await sql`truncate users, organizations, taxonomy_terms cascade`;
	} else if (await hasEvents()) {
		console.log('Database already has events — only filling in demo images.');
		console.log('Use `npm run db:seed -- --reset` to start over.');
		await enrichDemo();
		return;
	}
	await createDemoData(LOCAL_DEMO_ADMIN, LOCAL_DEMO_ORGANIZER_PASSWORD);
	console.log('Logins:  admin@example.com / nextep-admin   (platform admin)');
	console.log('         jarjestaja@example.com / nextep-demo  (owner of "Toivon seurakunta")');
}

/**
 * For SEED_ON_START: fills the database with demo data if it has no users yet, so a fresh staging
 * (and the previews copied from it) comes up usable. The admin signs in with the given login; the
 * demo organizer gets no password (an admin can set one under Ylläpito → Käyttäjät).
 * Returns whether it seeded.
 */
export async function seedEmptyDatabase(admin: DemoLogin): Promise<boolean> {
	const [{ hasUsers }] = await sql<
		{ hasUsers: boolean }[]
	>`select exists (select 1 from users) as "hasUsers"`;
	if (hasUsers) return false;
	await createDemoData(admin, null);
	console.log(`[seed] demo data added; admin login ${admin.email}`);
	return true;
}

async function createDemoData(adminLogin: DemoLogin, organizerPassword: string | null) {
	for (const [kind, terms] of Object.entries(TERMS) as [
		TaxonomyKind,
		(typeof TERMS)[TaxonomyKind]
	][]) {
		for (const [i, [slug, fi, en]] of terms.entries()) {
			await upsertTerm({ kind, slug, labels: { fi, en }, sort: i });
		}
	}
	const termIds = new Map((await listTerms()).map((t) => [`${t.kind}:${t.slug}`, t.id]));

	// Demo users own the demo data and sign in with a password (example.com can't use OAuth).
	const admin = await createUser({
		email: adminLogin.email,
		name: 'Nextep Admin',
		password: adminLogin.password,
		isAdmin: true
	});
	const organizer = await createUser({
		email: 'jarjestaja@example.com',
		name: 'Demo Järjestäjä',
		password: organizerPassword
	});

	for (const [index, seed] of ORGS.entries()) {
		const org = await createOrganization({
			name: seed.name,
			city: seed.city,
			description: seed.description,
			status: 'verified'
		});
		await addMember(org.id, index === 0 ? organizer.id : admin.id, 'owner');

		for (const ev of seed.events) {
			const input: EventInput = {
				title: ev.title,
				extract: ev.extract,
				description: longDescription(ev.extract, ev.title, ev.venue, seed.city),
				dtstartLocal: `${ev.weekday !== undefined ? nextWeekday(ev.weekday) : inDays(ev.inDays ?? 1)}T${ev.start}`,
				durationMinutes:
					(Number(ev.end.slice(0, 2)) - Number(ev.start.slice(0, 2))) * 60 +
					Number(ev.end.slice(3)) -
					Number(ev.start.slice(3)),
				rrule: ev.weekday !== undefined ? `FREQ=WEEKLY;BYDAY=${WEEKDAY_CODES[ev.weekday]}` : null,
				venueName: ev.venue,
				streetAddress: null,
				city: seed.city,
				lat: null,
				lng: null,
				url: null,
				termIds: [...ev.terms, `denomination:${seed.denomination}`]
					.map((key) => termIds.get(key))
					.filter((id): id is string => !!id)
			};
			await createEvent(org.id, input, 'published');
		}
	}

	await enrichDemo();
	console.log(`Seeded ${ORGS.length} organizations.`);
}
