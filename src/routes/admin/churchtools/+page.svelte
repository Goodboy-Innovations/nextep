<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>ChurchTools — Nextep</title></svelte:head>

{#if form?.message}<p class="notice">{form.message}</p>{/if}
{#if form?.error}<p class="notice warn">{form.error}</p>{/if}

<p class="hint">
	Seurakunnat yhdistävät ChurchToolsinsa itse <a href="/register">rekisteröitymällä</a>, ja uusi
	organisaatio odottaa tarkistusta Organisaatiot-sivulla. Jos seurakunta luo OAuth-asiakkaan
	uudelleen, se rekisteröityy uudelleen samalla sivulla. Seurakunnan kirjautumisen voi estää
	jäädyttämällä organisaation.
</p>

<div class="card table-wrap">
	<table>
		<thead><tr><th>Osoite</th><th>Organisaatio</th><th>Client ID</th><th></th></tr></thead>
		<tbody>
			{#each data.instances as instance (instance.host)}
				<tr>
					<td>{instance.host}</td>
					<td>
						{#if instance.org}<a href="/dashboard/{instance.org.slug}">{instance.org.name}</a
							>{:else}<span class="muted">—</span>{/if}
					</td>
					<td><code>{instance.clientId}</code></td>
					<td>
						{#if !instance.org}<form method="POST" action="?/remove">
								<input type="hidden" name="host" value={instance.host} />
								<button class="danger">Poista</button>
							</form>{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="4" class="muted">Ei yhdistettyjä ChurchTooleja.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	code {
		word-break: break-all;
	}
</style>
