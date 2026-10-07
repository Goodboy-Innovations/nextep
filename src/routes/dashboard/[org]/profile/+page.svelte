<script lang="ts">
	import { ROLE_LABELS } from '$lib/format';
	import ChurchToolsAutofill from '$lib/components/churchtools/ChurchToolsAutofill.svelte';

	let { data, form } = $props();
	const org = $derived(data.org);
	const canEdit = $derived(data.role === 'admin' || data.role === 'owner');
	/** Values fetched from ChurchTools override the saved ones until the form is saved. */
	const shown = $derived.by(() => {
		const prefill = form && 'prefill' in form ? form.prefill : null;
		return {
			name: prefill?.name ?? org.name,
			streetAddress: prefill?.streetAddress ?? org.streetAddress,
			postalCode: prefill?.postalCode ?? org.postalCode,
			city: prefill?.city ?? org.city,
			lat: prefill?.lat ?? org.lat,
			lng: prefill?.lng ?? org.lng,
			prefilled: !!prefill
		};
	});
</script>

<svelte:head><title>Profiili — {org.name}</title></svelte:head>

{#if data.registered && !form}
	<p class="notice">
		Seurakunta on rekisteröity ja odottaa tarkistusta. Nimi ja osoite haettiin ChurchToolsista —
		tarkista ne ja täydennä profiili. Tapahtumat tulevat julkisiksi, kun seurakunta on vahvistettu.
	</p>
{/if}
{#if form?.saved}<p class="notice">Tallennettu.</p>{/if}
{#if shown.prefilled}
	<p class="notice">Tiedot haettu ChurchToolsista. Tarkista ne ja tallenna.</p>
{/if}
{#if form?.error}<p class="notice warn">{form.error}</p>{/if}

<div class="profile-layout">
	<form method="POST" action="?/save" class="card">
		{#if canEdit && data.churchtoolsHost}<ChurchToolsAutofill host={data.churchtoolsHost} />{/if}
		<fieldset disabled={!canEdit}>
			<div class="field">
				<label for="name">Nimi</label>
				<input id="name" name="name" required value={shown.name} />
			</div>
			<div class="field">
				<label for="description">Kuvaus</label>
				<textarea id="description" name="description">{org.description}</textarea>
			</div>
			<div class="row">
				<div class="field">
					<label for="businessId">Y-tunnus</label>
					<input id="businessId" name="businessId" value={org.businessId ?? ''} />
				</div>
				<div class="field">
					<label for="website">Verkkosivu</label>
					<input id="website" name="website" type="url" value={org.website ?? ''} />
				</div>
			</div>
			<div class="row">
				<div class="field">
					<label for="email">Sähköposti</label>
					<input id="email" name="email" type="email" value={org.email ?? ''} />
				</div>
				<div class="field">
					<label for="phone">Puhelin</label>
					<input id="phone" name="phone" value={org.phone ?? ''} />
				</div>
			</div>
			<div class="row">
				<div class="field">
					<label for="streetAddress">Katuosoite</label>
					<input id="streetAddress" name="streetAddress" value={shown.streetAddress ?? ''} />
				</div>
				<div class="field">
					<label for="postalCode">Postinumero</label>
					<input id="postalCode" name="postalCode" value={shown.postalCode ?? ''} />
				</div>
				<div class="field">
					<label for="city">Kaupunki</label>
					<select id="city" name="city">
						{#each data.cities as city (city)}<option selected={shown.city === city}>{city}</option
							>{/each}
					</select>
				</div>
			</div>
			<div class="row">
				<div class="field">
					<label for="lat"
						>Leveysaste <span class="hint">— tyhjennä, niin käytetään kaupungin keskustaa</span
						></label
					>
					<input id="lat" name="lat" inputmode="decimal" value={shown.lat} />
				</div>
				<div class="field">
					<label for="lng">Pituusaste <span class="hint">— valinnainen</span></label>
					<input id="lng" name="lng" inputmode="decimal" value={shown.lng} />
				</div>
			</div>
			{#if canEdit}<button type="submit">Tallenna</button>{/if}
		</fieldset>
	</form>

	<aside class="card">
		<h3>Jäsenet</h3>
		<ul class="members">
			{#each data.members as m (m.userId)}
				<li>
					<strong>{m.name}</strong><br /><span class="hint">{m.email} · {ROLE_LABELS[m.role]}</span>
				</li>
			{/each}
		</ul>
		{#if data.requests.length}
			<h3>Odottavat pyynnöt</h3>
			<ul class="members">
				{#each data.requests as r (r.userId)}
					<li>
						<strong>{r.name}</strong><br /><span class="hint">{r.email}</span>
						<form method="POST" action="?/approve" class="answer">
							<input type="hidden" name="userId" value={r.userId} />
							<select name="role" aria-label="Rooli: {r.name}">
								<option value="editor">{ROLE_LABELS.editor}</option>
								<option value="admin">{ROLE_LABELS.admin}</option>
							</select>
							<button class="small">Hyväksy</button>
							<button formaction="?/decline" class="secondary small">Hylkää</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="hint">
			{#if data.churchtoolsHost}
				Seurakuntasi jäsenet voivat pyytää pääsyä kirjautumalla ChurchToolsilla ({data.churchtoolsHost}).
			{:else}
				Alpha-vaiheessa ylläpito lisää jäsenet.
			{/if}
		</p>
	</aside>
</div>

<style>
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	.profile-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 24px;
		align-items: start;
	}
	.members {
		list-style: none;
		padding: 0;
	}
	.members li {
		margin-bottom: 8px;
	}
	.answer {
		display: flex;
		gap: 6px;
		margin-top: 6px;
		flex-wrap: wrap;
	}
	.answer select {
		width: auto;
	}
	.small {
		padding: 4px 10px;
		font-size: 0.85rem;
	}
	@media (max-width: 860px) {
		.profile-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
