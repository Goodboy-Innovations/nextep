<script lang="ts">
	import { STATUS_LABELS } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Ylläpito — Nextep</title></svelte:head>

{#if form?.created}<p class="notice">Luotu: {form.created}</p>{/if}
{#if form?.error}<p class="notice warn">{form.error}</p>{/if}

<form method="POST" action="?/create" class="card create">
	<h2>Uusi organisaatio</h2>
	<div class="row">
		<div class="field">
			<label for="name">Nimi</label>
			<input id="name" name="name" required />
		</div>
		<div class="field">
			<label for="city">Kaupunki</label>
			<select id="city" name="city">
				{#each data.cities as city (city)}<option>{city}</option>{/each}
			</select>
		</div>
	</div>
	<button type="submit">Luo (vahvistettuna)</button>
	<p class="hint">Lisää sitten jäsen Käyttäjät-sivulla. Muut tiedot organisaatio täyttää itse.</p>
</form>

<div class="card table-wrap">
	<table>
		<thead
			><tr
				><th>Nimi</th><th>Kaupunki</th><th>Tila</th><th
					title="Montako tapahtumaa samalta viikolta voi olla etusivulla">Etusivulla / vko</th
				></tr
			></thead
		>
		<tbody>
			{#each data.orgs as org (org.id)}
				<tr>
					<td><a href="/dashboard/{org.slug}">{org.name}</a></td>
					<td>{org.city}</td>
					<td>
						<form method="POST" action="?/status" class="status">
							<input type="hidden" name="id" value={org.id} />
							<select name="status" aria-label="Tila">
								{#each data.statuses as s (s)}<option value={s} selected={org.status === s}
										>{STATUS_LABELS[s]}</option
									>{/each}
							</select>
							<button class="secondary">Vaihda</button>
						</form>
					</td>
					<td>
						<form method="POST" action="?/frontPage" class="status">
							<input type="hidden" name="id" value={org.id} />
							<input
								type="number"
								name="limit"
								min="0"
								max={data.maxFrontPage}
								value={org.frontPageLimit}
								aria-label="Etusivulla viikossa enintään: {org.name}"
								class="limit"
							/>
							<button class="secondary">Tallenna</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.create {
		margin-bottom: 24px;
	}
	.status {
		display: flex;
		gap: 8px;
	}
	.status select {
		width: auto;
	}
	.limit {
		width: 72px !important;
	}
</style>
