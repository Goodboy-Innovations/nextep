import { z } from 'zod';
import { WEEKDAYS, buildRRule, type RecurrenceForm } from './recurrence';

const optionalText = z
	.string()
	.trim()
	.transform((v) => v || null)
	.nullable()
	.optional();

const optionalNumber = z
	.string()
	.trim()
	.transform((v) => (v === '' ? null : Number(v)))
	.pipe(z.number().finite().nullable())
	.optional();

export const eventFormSchema = z
	.object({
		title: z.string().trim().min(3, 'Otsikko on liian lyhyt').max(140),
		extract: z.string().trim().max(280, 'Enintään 280 merkkiä').default(''),
		description: z.string().trim().max(10_000).default(''),
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valitse päivämäärä'),
		startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Anna alkamisaika'),
		endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Anna päättymisaika'),
		recurrence: z.enum(['none', 'weekly', 'custom']).default('none'),
		interval: z.coerce.number().int().min(1).max(8).default(1),
		byDay: z.array(z.enum(WEEKDAYS)).default([]),
		until: optionalText,
		customRrule: optionalText,
		venueName: optionalText,
		streetAddress: optionalText,
		city: z.string().trim().min(1, 'Valitse kaupunki'),
		lat: optionalNumber,
		lng: optionalNumber,
		url: z
			.string()
			.trim()
			.transform((v) => v || null)
			.pipe(z.url('Anna kelvollinen osoite').nullable())
			.optional(),
		termIds: z.array(z.uuid()).default([])
	})
	.refine((v) => v.recurrence !== 'weekly' || v.byDay.length > 0, {
		message: 'Valitse vähintään yksi viikonpäivä',
		path: ['byDay']
	});

export type EventForm = z.infer<typeof eventFormSchema>;

/** The shape the events service stores, derived from the form. */
export interface EventInput {
	title: string;
	extract: string;
	description: string;
	dtstartLocal: string;
	durationMinutes: number;
	rrule: string | null;
	venueName: string | null;
	streetAddress: string | null;
	city: string;
	lat: number | null;
	lng: number | null;
	url: string | null;
	termIds: string[];
}

export function formToInput(form: EventForm): EventInput {
	const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
	let duration = toMinutes(form.endTime) - toMinutes(form.startTime);
	if (duration <= 0) duration += 24 * 60; // ends after midnight

	const recurrence: RecurrenceForm =
		form.recurrence === 'weekly'
			? { kind: 'weekly', interval: form.interval, byDay: form.byDay, until: form.until ?? null }
			: form.recurrence === 'custom' && form.customRrule
				? { kind: 'custom', rrule: form.customRrule }
				: { kind: 'none' };

	return {
		title: form.title,
		extract: form.extract,
		description: form.description,
		dtstartLocal: `${form.date}T${form.startTime}`,
		durationMinutes: duration,
		rrule: buildRRule(recurrence),
		venueName: form.venueName ?? null,
		streetAddress: form.streetAddress ?? null,
		city: form.city,
		lat: form.lat ?? null,
		lng: form.lng ?? null,
		url: form.url ?? null,
		termIds: form.termIds
	};
}

/** Rebuilds form values from a rejected submission so the user doesn't lose their input. */
export function submittedValues(values: Record<string, unknown>) {
	const str = (k: string) => (typeof values[k] === 'string' ? (values[k] as string) : '');
	const kind = str('recurrence');
	return {
		title: str('title'),
		extract: str('extract'),
		description: str('description'),
		date: str('date'),
		startTime: str('startTime'),
		endTime: str('endTime'),
		recurrence:
			kind === 'weekly'
				? {
						kind: 'weekly' as const,
						interval: Number(str('interval')) || 1,
						byDay: (values.byDay as string[]) ?? [],
						until: str('until') || null
					}
				: kind === 'custom'
					? { kind: 'custom' as const, rrule: str('customRrule') }
					: { kind: 'none' as const },
		venueName: str('venueName'),
		streetAddress: str('streetAddress'),
		city: str('city'),
		lat: str('lat'),
		lng: str('lng'),
		url: str('url'),
		termIds: (values.termIds as string[]) ?? []
	};
}

/** Parses submitted form data. Returns field errors keyed by field name on failure. */
export function parseEventForm(
	data: FormData
):
	| { ok: true; input: EventInput }
	| { ok: false; errors: Record<string, string>; values: ReturnType<typeof submittedValues> } {
	const values = {
		...Object.fromEntries(data),
		byDay: data.getAll('byDay'),
		termIds: data.getAll('termIds')
	};
	const result = eventFormSchema.safeParse(values);
	if (!result.success) {
		const errors: Record<string, string> = {};
		for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
		return { ok: false, errors, values: submittedValues(values) };
	}
	return { ok: true, input: formToInput(result.data) };
}
