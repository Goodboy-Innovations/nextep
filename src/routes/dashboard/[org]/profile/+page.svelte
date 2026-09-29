<script lang="ts">
	import { ROLE_LABELS } from '$lib/format';

	let { data, form } = $props();
	const org = $derived(data.org);
	const canEdit = $derived(data.role === 'admin' || data.role === 'owner');
</script>

<svelte:head><title>Profiili — {org.name}</title></svelte:head>

{#if form?.saved}<p class="notice">Tallennettu.</p>{/if}
{#if form?.error}<p class="notice warn">{form.error}</p>{/if}

<div class="profile-layout">
	<form method="POST" class="card">
		<fieldset disabled={!canEdit}>
			<div class="field">
				<label for="name">Nimi</label>
				<input id="name" name="name" required value={org.name} />
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
					<input id="streetAddress" name="streetAddress" value={org.streetAddress ?? ''} />
				</div>
				<div class="field">
					<label for="postalCode">Postinumero</label>
					<input id="postalCode" name="postalCode" value={org.postalCode ?? ''} />
				</div>
				<div class="field">
					<label for="city">Kaupunki</label>
					<select id="city" name="city">
						{#each data.cities as city (city)}<option selected={org.city === city}>{city}</option
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
					<input id="lat" name="lat" inputmode="decimal" value={org.lat} />
				</div>
				<div class="field">
					<label for="lng">Pituusaste <span class="hint">— valinnainen</span></label>
					<input id="lng" name="lng" inputmode="decimal" value={org.lng} />
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
		<p class="hint">Jäsenten kutsuminen tulee myöhemmin. Alpha-vaiheessa ylläpito lisää jäsenet.</p>
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
	@media (max-width: 860px) {
		.profile-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
