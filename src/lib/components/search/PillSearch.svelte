<!--
	Tokenized ("pill") search bar with a two-step query builder:
	  empty input  → quick picks + filter categories
	  category     → only that category's values (chips), with a back button
	  typing       → a short list of matching values + "search for this text"
	Clicking a pill opens its category for editing. Quick picks sit under the bar.

	Filters (text, place, distance, date) narrow the results and are pills in the bar.
	Preferences (taxonomy terms) only boost, so they have their own row and panel.

	Without JavaScript: pills are links that remove themselves, and the text box submits a
	normal GET form that carries the other filters as hidden inputs.
-->
<script lang="ts">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		OWN_LOCATION,
		SEARCH_PATH,
		searchUrl,
		withTerm,
		withoutPill,
		type Pill,
		type PillKey,
		type SearchOptions,
		type SearchState
	} from '$lib/search';

	interface Props {
		state: SearchState;
		/** Filter pills, shown in the bar. */
		pills: Pill[];
		/** Preference pills, shown on their own row. */
		prefPills: Pill[];
		options: SearchOptions;
		placeholder?: string;
	}

	let {
		state: search,
		pills,
		prefPills,
		options,
		placeholder = 'Hae tapahtumia tai lisää suodatin…'
	}: Props = $props();

	/** A value the user can pick, with the state it leads to. */
	interface Choice {
		id: string;
		label: string;
		selected?: boolean;
		next: () => SearchState | 'locate';
	}

	interface Category {
		id: string;
		label: string;
		icon: string;
		choices: Choice[];
		/** Lay choices out as a compact grid (long lists like cities). */
		grid?: boolean;
	}

	let open = $state(false);
	/** null = the root panel; otherwise the id of the open category. */
	let categoryId: string | null = $state(null);
	let text = $state('');
	let active = $state(0);
	let locating = $state(false);
	let prefsOpen = $state(false);
	let root: HTMLDivElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();

	const categories = $derived.by((): Category[] => {
		return [
			{
				id: 'place',
				label: 'Paikka',
				icon: '📍',
				grid: true,
				choices: [
					{ id: 'own', label: '📍 Oma sijainti', next: () => 'locate' },
					...options.cities.map((city) => ({
						id: `city-${city}`,
						label: city,
						selected: search.place === city,
						next: () => ({ ...search, place: city, lat: null, lng: null })
					}))
				]
			},
			{
				id: 'km',
				label: 'Etäisyys',
				icon: '↔',
				choices: [
					...options.distances.map((km) => ({
						id: `km-${km}`,
						label: `${km} km`,
						selected: search.maxKm === km,
						next: () => ({ ...search, maxKm: km })
					})),
					{
						id: 'km-any',
						label: 'Kaikkialla',
						selected: search.maxKm === null,
						next: () => ({ ...search, maxKm: null })
					}
				]
			},
			{
				id: 'date',
				label: 'Päivä',
				icon: '📅',
				choices: options.datePresets.map((p) => ({
					id: `date-${p.date}-${p.label}`,
					label: p.label,
					selected: search.date === p.date,
					next: () => ({ ...search, date: p.date })
				}))
			}
		];
	});

	const prefGroups = $derived(
		options.termGroups.map((g) => ({
			...g,
			terms: g.terms.map((t) => {
				const selected = search.terms.includes(t.key);
				return {
					...t,
					selected,
					next: selected ? withoutPill(search, `t:${t.key}`) : withTerm(search, t.key)
				};
			})
		}))
	);

	/** Categories offered on the root panel. Distance is edited through the place. */
	const rootCategories = $derived(categories.filter((c) => c.id !== 'km'));
	const category = $derived(categories.find((c) => c.id === categoryId) ?? null);

	const quickPicks = $derived.by((): Choice[] => {
		const weekend = options.datePresets.find((p) => p.label === 'Viikonloppuna');
		const today = options.datePresets.find((p) => p.label === 'Tänään');
		return [
			{ id: 'q-near', label: '📍 Lähelläni', next: () => 'locate' },
			...(today
				? [
						{
							id: 'q-today',
							label: 'Tänään',
							selected: search.date === today.date,
							next: () => ({ ...search, date: today.date })
						}
					]
				: []),
			...(weekend
				? [
						{
							id: 'q-weekend',
							label: 'Viikonloppuna',
							selected: search.date === weekend.date,
							next: () => ({ ...search, date: weekend.date })
						}
					]
				: [])
		];
	});

	/** Typing: matching values across categories, best first. */
	const matches = $derived.by(() => {
		const needle = text.trim().toLowerCase();
		if (!needle) return [];
		const found: (Choice & { category: string })[] = [];
		for (const c of rootCategories) {
			for (const choice of c.choices) {
				const label = choice.label.toLowerCase().replace(/^📍 /, '');
				if (!choice.selected && label.includes(needle)) {
					found.push({ ...choice, category: c.label, id: `${c.id}-${choice.id}` });
				}
			}
		}
		found.sort((a, b) => {
			const ap = a.label.toLowerCase().startsWith(needle) ? 0 : 1;
			const bp = b.label.toLowerCase().startsWith(needle) ? 0 : 1;
			return ap - bp;
		});
		return found.slice(0, 7);
	});

	function go(next: SearchState) {
		text = '';
		open = false;
		categoryId = null;
		goto(searchUrl(next), { keepFocus: true, noScroll: true });
	}

	function pick(choice: Choice) {
		const next = choice.next();
		if (next === 'locate') locate();
		else go(next);
	}

	/** Stand-in location in development: browsers refuse geolocation over plain-http LAN. */
	const DEV_LOCATION = { lat: 60.17, lng: 24.94 }; // Helsinki

	function locate() {
		const useLocation = (lat: number, lng: number) =>
			go({
				...search,
				place: OWN_LOCATION,
				lat: Number(lat.toFixed(2)),
				lng: Number(lng.toFixed(2))
			});
		// No location available: in development pretend, otherwise let the seeker pick a city.
		const fallback = () => {
			locating = false;
			if (dev) useLocation(DEV_LOCATION.lat, DEV_LOCATION.lng);
			else openCategory('place');
		};
		if (!navigator.geolocation) return fallback();
		locating = true;
		open = false;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				locating = false;
				useLocation(pos.coords.latitude, pos.coords.longitude);
			},
			fallback,
			{ maximumAge: 600_000, timeout: 10_000 }
		);
	}

	function openCategory(id: string | null) {
		categoryId = id;
		open = true;
		text = '';
		input?.focus();
	}

	/** Which category a pill edits when clicked. */
	const pillCategory = (key: PillKey): string | null => (key === 'q' ? null : key);

	function onKeydown(e: KeyboardEvent) {
		const rows = text.trim() ? matches.length + 1 : 0; // +1 = "search for text"
		if (e.key === 'ArrowDown' && rows) {
			e.preventDefault();
			active = (active + 1) % rows;
		} else if (e.key === 'ArrowUp' && rows) {
			e.preventDefault();
			active = (active - 1 + rows) % rows;
		} else if (e.key === 'Escape') {
			if (categoryId) categoryId = null;
			else open = false;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (text.trim() && active > 0 && matches[active - 1]) pick(matches[active - 1]);
			else if (text.trim()) go({ ...search, q: text.trim() });
			else go(search);
		} else if (e.key === 'Backspace' && text === '' && pills.length) {
			go(withoutPill(search, pills[pills.length - 1].key));
		}
	}

	function onFocusOut(e: FocusEvent) {
		if (!root?.contains(e.relatedTarget as Node | null)) {
			open = false;
			categoryId = null;
		}
	}

	// Unique per instance, so several bars can live on one page.
	const uid = $props.id();
	const panelId = `${uid}-panel`;
	const prefsId = `${uid}-prefs`;
	const optionId = (i: number) => `${uid}-option-${i}`;
</script>

<div class="pill-search" bind:this={root} onfocusout={onFocusOut}>
	<div class="quick-row" role="group" aria-label="Pikavalinnat">
		{#each quickPicks as choice (choice.id)}
			<button
				type="button"
				class="chip"
				class:selected={choice.selected}
				aria-pressed={choice.selected ?? false}
				onclick={() => pick(choice)}>{choice.label}</button
			>
		{/each}
	</div>

	<div class="bar-wrap">
		<form method="GET" action={SEARCH_PATH} role="search" class="bar">
			<input type="hidden" name="filters" value="1" />
			{#if search.date}<input type="hidden" name="date" value={search.date} />{/if}
			{#if search.place === OWN_LOCATION && search.lat !== null && search.lng !== null}
				<input type="hidden" name="lat" value={search.lat} />
				<input type="hidden" name="lng" value={search.lng} />
			{:else}
				<input type="hidden" name="city" value={search.place ?? ''} />
			{/if}
			<input type="hidden" name="km" value={search.maxKm === null ? 'any' : search.maxKm} />
			{#each search.terms as t (t)}<input type="hidden" name="t" value={t} />{/each}

			<span class="icon" aria-hidden="true">⌕</span>
			<ul class="pills" aria-label="Valitut suodattimet">
				{#each pills as pill (pill.key)}
					{@const cat = pillCategory(pill.key)}
					<li class="pill">
						{#if cat}
							<button
								type="button"
								class="pill-label"
								onclick={() => openCategory(cat)}
								aria-label="Muokkaa: {pill.kind} {pill.label}"
							>
								<span class="kind">{pill.kind}</span>{pill.label}
							</button>
						{:else}
							<span class="pill-label"><span class="kind">{pill.kind}</span>{pill.label}</span>
						{/if}
						<a
							href={searchUrl(withoutPill(search, pill.key))}
							class="remove"
							aria-label="Poista suodatin: {pill.label}"
							data-sveltekit-keepfocus
							data-sveltekit-noscroll>×</a
						>
					</li>
				{/each}
			</ul>
			<input
				bind:this={input}
				bind:value={text}
				name="q"
				type="search"
				autocomplete="off"
				placeholder={pills.length ? 'Lisää…' : placeholder}
				aria-label="Hae tapahtumia"
				role="combobox"
				aria-expanded={open}
				aria-controls={panelId}
				aria-autocomplete="list"
				aria-activedescendant={open && text.trim() ? optionId(active) : undefined}
				onfocus={() => (open = true)}
				oninput={() => {
					open = true;
					categoryId = null;
					active = 0;
				}}
				onkeydown={onKeydown}
			/>
			<button type="submit" class="submit">{locating ? 'Haetaan…' : 'Hae'}</button>
		</form>

		{#if open}
			<div id={panelId} class="panel">
				{#if text.trim()}
					<ul role="listbox" class="results" aria-label="Ehdotukset">
						<li
							id={optionId(0)}
							role="option"
							aria-selected={active === 0}
							class:active={active === 0}
							onmousedown={(e) => {
								e.preventDefault();
								go({ ...search, q: text.trim() });
							}}
						>
							<span>⌕ Hae tekstillä <strong>”{text.trim()}”</strong></span>
						</li>
						{#each matches as m, i (m.id)}
							<li
								id={optionId(i + 1)}
								role="option"
								aria-selected={active === i + 1}
								class:active={active === i + 1}
								onmousedown={(e) => {
									e.preventDefault();
									pick(m);
								}}
							>
								<span>{m.label}</span>
								<span class="result-kind">{m.category}</span>
							</li>
						{/each}
					</ul>
				{:else if category}
					<div class="panel-head">
						<button type="button" class="back" onclick={() => openCategory(null)}>← Takaisin</button
						>
						<strong>{category.label}</strong>
					</div>
					<div class="chips" class:grid={category.grid}>
						{#each category.choices as choice (choice.id)}
							<button
								type="button"
								class="chip"
								class:selected={choice.selected}
								aria-pressed={choice.selected ?? false}
								onclick={() => pick(choice)}>{choice.label}</button
							>
						{/each}
					</div>
					{#if category.id === 'date'}
						<label class="date-pick">
							<span>Tai valitse päivä</span>
							<input
								type="date"
								value={search.date ?? ''}
								onchange={(e) => {
									if (e.currentTarget.value) go({ ...search, date: e.currentTarget.value });
								}}
							/>
						</label>
					{/if}
					{#if category.id === 'place' && search.place}
						<div class="panel-head sub"><strong>Etäisyys</strong></div>
						<div class="chips">
							{#each categories.find((c) => c.id === 'km')?.choices ?? [] as choice (choice.id)}
								<button
									type="button"
									class="chip"
									class:selected={choice.selected}
									aria-pressed={choice.selected ?? false}
									onclick={() => pick(choice)}>{choice.label}</button
								>
							{/each}
						</div>
					{/if}
				{:else}
					<div class="section-label">Lisää suodatin</div>
					<div class="chips">
						{#each rootCategories as c (c.id)}
							<button type="button" class="chip category" onclick={() => openCategory(c.id)}>
								<span aria-hidden="true">{c.icon}</span>
								{c.label}
								<span class="chev" aria-hidden="true">›</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="prefs-row">
		<button
			type="button"
			class="chip prefs-toggle"
			aria-expanded={prefsOpen}
			aria-controls={prefsId}
			onclick={() => (prefsOpen = !prefsOpen)}
		>
			Mieltymykset{#if prefPills.length}&nbsp;<span class="count">{prefPills.length}</span>{/if}
			<span class="chev" aria-hidden="true">{prefsOpen ? '▴' : '▾'}</span>
		</button>
		<ul class="pref-pills" aria-label="Valitut mieltymykset">
			{#each prefPills as pill (pill.key)}
				<li class="pill soft">
					<button
						type="button"
						class="pill-label"
						onclick={() => (prefsOpen = true)}
						aria-label="Muokkaa mieltymyksiä: {pill.label}"
					>
						<span class="kind">{pill.kind}</span>{pill.label}
					</button>
					<a
						href={searchUrl(withoutPill(search, pill.key))}
						class="remove"
						aria-label="Poista mieltymys: {pill.label}"
						data-sveltekit-keepfocus
						data-sveltekit-noscroll>×</a
					>
				</li>
			{/each}
		</ul>
	</div>

	{#if prefsOpen}
		<div id={prefsId} class="prefs-panel">
			<p class="note">
				Mieltymykset nostavat sopivia tapahtumia ylemmäs, mutta eivät piilota muita. Ne muistetaan
				tällä laitteella.
			</p>
			{#each prefGroups as g (g.kind)}
				<div class="section-label">{g.label}</div>
				<div class="chips">
					{#each g.terms as t (t.key)}
						<a
							href={searchUrl(t.next)}
							class="chip"
							class:selected={t.selected}
							aria-current={t.selected ? 'true' : undefined}
							data-sveltekit-keepfocus
							data-sveltekit-noscroll>{t.label}</a
						>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* The filter panel hangs from the bar itself, over the rows below it. */
	.bar-wrap {
		position: relative;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 6px 6px 6px 14px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: 14px;
		box-shadow: var(--shadow);
	}
	.bar:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	.icon {
		color: var(--muted);
		font-size: 1.2rem;
	}
	.pills {
		display: contents;
		list-style: none;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 3px 2px 4px;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		font-size: 0.9rem;
		white-space: nowrap;
	}
	.pill.soft {
		background: var(--accent-soft);
		border-color: transparent;
	}
	.pill-label {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		padding: 3px 4px 3px 6px;
		border: none;
		border-radius: 999px;
		background: none;
		color: var(--text);
		font: inherit;
		font-weight: 500;
	}
	button.pill-label:hover {
		background: rgb(0 0 0 / 0.05);
		color: var(--text);
	}
	.kind {
		color: var(--muted);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.remove {
		display: inline-grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		color: var(--muted);
		text-decoration: none;
		font-size: 1.1rem;
		line-height: 1;
	}
	.remove:hover,
	.remove:focus-visible {
		background: var(--border);
		color: var(--text);
	}
	input[type='search'] {
		flex: 1 1 160px;
		min-width: 120px;
		border: none;
		padding: 8px 4px;
		background: transparent;
		font-size: 1rem;
		outline: none;
	}
	input[type='search']:focus-visible {
		outline: none;
	}
	.submit {
		border-radius: 10px;
		padding: 9px 18px;
	}

	.panel {
		position: absolute;
		z-index: 20;
		left: 0;
		right: 0;
		top: calc(100% + 6px);
		max-height: min(420px, 70vh);
		overflow-y: auto;
		padding: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: var(--shadow-lg);
	}
	.section-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
		margin: 2px 2px 8px;
	}
	.chips + .section-label {
		margin-top: 14px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chips.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
	}
	.chip {
		justify-content: center;
		padding: 7px 12px;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
		font-size: 0.93rem;
	}
	.chips.grid .chip {
		border-radius: 10px;
	}
	.chip:hover {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent-strong);
	}
	.chip.selected {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
	.quick-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 10px;
	}
	.prefs-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
	}
	a.chip {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}
	.prefs-toggle {
		gap: 6px;
		background: transparent;
		border-style: dashed;
	}
	.count {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-size: 0.78rem;
	}
	.pref-pills {
		display: contents;
		list-style: none;
	}
	.prefs-panel {
		margin-top: 10px;
		padding: 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
	}
	.prefs-panel .note {
		margin: 0 2px 14px;
	}
	.chip.category {
		gap: 8px;
	}
	.chev {
		color: var(--muted);
	}
	.panel-head {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}
	.panel-head.sub {
		margin: 16px 0 8px;
	}
	.back {
		padding: 4px 10px;
		font-size: 0.88rem;
		background: var(--surface-2);
		border-color: var(--border);
		color: var(--text);
	}
	.back:hover {
		background: var(--border);
		border-color: var(--border-strong);
		color: var(--text);
	}
	.date-pick {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 14px 0 0;
		font-weight: 500;
	}
	.date-pick input {
		width: auto;
	}
	.note {
		margin: 12px 2px 0;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.results {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.results li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 9px 10px;
		border-radius: 8px;
		cursor: pointer;
	}
	.results li.active,
	.results li:hover {
		background: var(--accent-soft);
	}
	.result-kind {
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
