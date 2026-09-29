<script lang="ts" module>
	interface Term {
		id: string;
		label: string;
	}

	export interface EventFormValues {
		title: string;
		extract: string;
		description: string;
		date: string;
		startTime: string;
		endTime: string;
		recurrence:
			| { kind: 'none' }
			| { kind: 'weekly'; interval: number; byDay: string[]; until: string | null }
			| { kind: 'custom'; rrule: string };
		venueName: string;
		streetAddress: string;
		city: string;
		lat: number | string | null;
		lng: number | string | null;
		url: string;
		termIds: string[];
	}
</script>

<script lang="ts">
	interface Props {
		values: EventFormValues;
		errors?: Record<string, string>;
		terms: Record<string, Term[]>;
		kindLabels: Record<string, string>;
		cities: string[];
		/** Current image URL, if any. */
		image?: string | null;
		/** Description length needed for the front page. */
		featureMinDescription?: number;
	}

	let {
		values,
		errors = {},
		terms,
		kindLabels,
		cities,
		image = null,
		featureMinDescription = 200
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let descriptionLength = $state(values.description.trim().length);
	let preview: string | null = $state(null);
	let imageNote = $state('');

	const MAX_SIDE = 1600;

	/** Downscales large photos in the browser before upload (the server still enforces 3 MB). */
	async function onImageChange(e: Event) {
		const inputEl = e.currentTarget as HTMLInputElement;
		const file = inputEl.files?.[0];
		imageNote = '';
		if (!file) return;
		preview = URL.createObjectURL(file);
		try {
			const bitmap = await createImageBitmap(file);
			const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
			if (scale === 1 && file.size < 1_500_000) return;
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(bitmap.width * scale);
			canvas.height = Math.round(bitmap.height * scale);
			canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
			if (!blob) return;
			const transfer = new DataTransfer();
			transfer.items.add(new File([blob], 'kuva.jpg', { type: 'image/jpeg' }));
			inputEl.files = transfer.files;
			imageNote = `Pienennetty ${canvas.width}×${canvas.height} px`;
		} catch {
			// Not decodable in the browser: upload as-is and let the server decide.
		}
	}

	const WEEKDAYS = [
		['MO', 'ma'],
		['TU', 'ti'],
		['WE', 'ke'],
		['TH', 'to'],
		['FR', 'pe'],
		['SA', 'la'],
		['SU', 'su']
	] as const;

	// Initial value only; the radio buttons own it afterwards.
	// svelte-ignore state_referenced_locally
	let recurrence = $state(values.recurrence.kind);
	const weekly = $derived(
		values.recurrence.kind === 'weekly'
			? values.recurrence
			: { interval: 1, byDay: [] as string[], until: null }
	);
	const selectedTerms = $derived(new Set(values.termIds));
</script>

<div class="stack">
	<section class="card">
		<h2>Perustiedot</h2>
		<div class="field">
			<label for="title">Otsikko</label>
			<input id="title" name="title" required maxlength="140" value={values.title} />
			{#if errors.title}<div class="error">{errors.title}</div>{/if}
		</div>
		<div class="field">
			<label for="extract"
				>Lyhyt kuvaus <span class="hint">— näkyy hakutuloksissa, enintään 280 merkkiä</span></label
			>
			<input id="extract" name="extract" maxlength="280" value={values.extract} />
			{#if errors.extract}<div class="error">{errors.extract}</div>{/if}
		</div>
		<div class="field">
			<label for="description">Kuvaus</label>
			<textarea
				id="description"
				name="description"
				oninput={(e) => (descriptionLength = e.currentTarget.value.trim().length)}
				>{values.description}</textarea
			>
			<div class="hint counter" class:ok={descriptionLength >= featureMinDescription}>
				{descriptionLength} merkkiä
				{#if descriptionLength < featureMinDescription}
					— etusivulle pääsy vaatii vähintään {featureMinDescription}
				{:else}
					— riittää etusivulle
				{/if}
			</div>
		</div>
		<div class="field">
			<label for="url"
				>Lisätietoja / ilmoittautuminen <span class="hint">— linkki, valinnainen</span></label
			>
			<input id="url" name="url" type="url" placeholder="https://" value={values.url} />
			{#if errors.url}<div class="error">{errors.url}</div>{/if}
		</div>
	</section>

	<section class="card">
		<h2>Kuva</h2>
		<p class="hint">Vaaka-asentoinen kuva (JPEG, PNG tai WebP). Tarvitaan etusivulle pääsyyn.</p>
		<div class="image-row">
			{#if preview || image}
				<img class="preview" src={preview ?? image} alt="Tapahtuman kuva" />
			{/if}
			<div class="field">
				<label for="image">{image ? 'Vaihda kuva' : 'Lisää kuva'}</label>
				<input
					id="image"
					name="image"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onchange={onImageChange}
				/>
				{#if imageNote}<div class="hint">{imageNote}</div>{/if}
				{#if errors.image}<div class="error">{errors.image}</div>{/if}
				{#if image}
					<label class="remove-image"
						><input type="checkbox" name="removeImage" value="1" /> Poista nykyinen kuva</label
					>
				{/if}
			</div>
		</div>
	</section>

	<section class="card">
		<h2>Aika</h2>
		<div class="row">
			<div class="field">
				<label for="date">{recurrence === 'none' ? 'Päivämäärä' : 'Ensimmäinen kerta'}</label>
				<input id="date" name="date" type="date" required value={values.date} />
				{#if errors.date}<div class="error">{errors.date}</div>{/if}
			</div>
			<div class="field">
				<label for="startTime">Alkaa</label>
				<input id="startTime" name="startTime" type="time" required value={values.startTime} />
			</div>
			<div class="field">
				<label for="endTime">Päättyy</label>
				<input id="endTime" name="endTime" type="time" required value={values.endTime} />
				{#if errors.endTime}<div class="error">{errors.endTime}</div>{/if}
			</div>
		</div>

		<fieldset class="field">
			<legend>Toistuvuus</legend>
			<div class="checks">
				<label
					><input type="radio" name="recurrence" value="none" bind:group={recurrence} /> Kertaluonteinen</label
				>
				<label
					><input type="radio" name="recurrence" value="weekly" bind:group={recurrence} /> Viikoittain</label
				>
				{#if values.recurrence.kind === 'custom'}
					<label
						><input type="radio" name="recurrence" value="custom" bind:group={recurrence} /> Oma sääntö</label
					>
				{/if}
			</div>
		</fieldset>

		{#if recurrence === 'weekly'}
			<div class="field">
				<span class="label">Viikonpäivät</span>
				<div class="checks">
					{#each WEEKDAYS as [code, label] (code)}
						<label
							><input
								type="checkbox"
								name="byDay"
								value={code}
								checked={weekly.byDay.includes(code)}
							/>
							{label}</label
						>
					{/each}
				</div>
				{#if errors.byDay}<div class="error">{errors.byDay}</div>{/if}
			</div>
			<div class="row">
				<div class="field">
					<label for="interval">Joka</label>
					<select id="interval" name="interval">
						{#each [1, 2, 3, 4] as n (n)}
							<option value={n} selected={weekly.interval === n}
								>{n === 1 ? 'viikko' : `${n}. viikko`}</option
							>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="until">Viimeinen päivä <span class="hint">— valinnainen</span></label>
					<input id="until" name="until" type="date" value={weekly.until ?? ''} />
				</div>
			</div>
		{:else if recurrence === 'custom' && values.recurrence.kind === 'custom'}
			<div class="field">
				<label for="customRrule">RRULE <span class="hint">— iCalendar-sääntö</span></label>
				<input id="customRrule" name="customRrule" value={values.recurrence.rrule} />
			</div>
		{/if}
	</section>

	<section class="card">
		<h2>Paikka</h2>
		<div class="row">
			<div class="field">
				<label for="venueName">Paikan nimi</label>
				<input
					id="venueName"
					name="venueName"
					placeholder="esim. Kallion kirkko"
					value={values.venueName}
				/>
			</div>
			<div class="field">
				<label for="streetAddress">Katuosoite</label>
				<input id="streetAddress" name="streetAddress" value={values.streetAddress} />
			</div>
			<div class="field">
				<label for="city">Kaupunki</label>
				<select id="city" name="city" required>
					{#if values.city && !cities.includes(values.city)}<option selected>{values.city}</option
						>{/if}
					{#each cities as city (city)}
						<option selected={values.city === city}>{city}</option>
					{/each}
				</select>
				{#if errors.city}<div class="error">{errors.city}</div>{/if}
			</div>
		</div>
		<details>
			<summary class="hint"
				>Tarkat koordinaatit (valinnainen — muuten käytetään kaupungin keskustaa)</summary
			>
			<div class="row">
				<div class="field">
					<label for="lat">Leveysaste</label>
					<input id="lat" name="lat" inputmode="decimal" value={values.lat ?? ''} />
				</div>
				<div class="field">
					<label for="lng">Pituusaste</label>
					<input id="lng" name="lng" inputmode="decimal" value={values.lng ?? ''} />
				</div>
			</div>
		</details>
	</section>

	<section class="card">
		<h2>Luokittelu</h2>
		<p class="hint">Luokittelu auttaa oikeita ihmisiä löytämään tapahtuman.</p>
		{#each Object.entries(terms) as [kind, list] (kind)}
			<div class="field">
				<span class="label">{kindLabels[kind]}</span>
				<div class="checks">
					{#each list as term (term.id)}
						<label
							><input
								type="checkbox"
								name="termIds"
								value={term.id}
								checked={selectedTerms.has(term.id)}
							/>
							{term.label}</label
						>
					{/each}
				</div>
			</div>
		{/each}
	</section>
</div>

<style>
	fieldset {
		border: none;
		padding: 0;
	}
	legend,
	.label {
		display: block;
		font-weight: 600;
		font-size: 0.9rem;
		margin-bottom: 6px;
	}
	h2 {
		font-size: 1.1rem;
	}
	summary {
		cursor: pointer;
		margin-bottom: 8px;
	}
	.counter {
		margin-top: 4px;
	}
	.counter.ok {
		color: var(--accent);
	}
	.image-row {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.preview {
		width: 220px;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: 10px;
		border: 1px solid var(--border);
	}
	.remove-image {
		font-weight: 400;
		display: inline-flex;
		gap: 6px;
		margin-top: 8px;
	}
</style>
