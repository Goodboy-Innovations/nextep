<script lang="ts">
	import { STATUS_LABELS, formatDate, formatTime } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>Tapahtumat — {data.org.name}</title></svelte:head>

<div class="actions">
	<a class="button" href="/dashboard/{data.org.slug}/events/new">+ Uusi tapahtuma</a>
	<span class="hint">Kalenterisyöte: <code>/o/{data.org.slug}/calendar.ics</code></span>
</div>

<div class="card usage">
	<strong>Etusivu</strong>
	<p class="hint">
		Tapahtumat, joilla on kuva ja vähintään 200 merkin kuvaus, pääsevät etusivulle automaattisesti.
		Samalta viikolta etusivulla näkyy enintään {data.org.frontPageLimit}
		tapahtumaanne — kullekin kävijälle ne, jotka sopivat hänelle parhaiten.
	</p>
</div>

{#if data.events.length === 0}
	<p class="card muted">Ei vielä tapahtumia. Luo ensimmäinen!</p>
{:else}
	<div class="card table-wrap">
		<table>
			<thead>
				<tr
					><th>Tapahtuma</th><th>Seuraava kerta</th><th>Toistuvuus</th><th>Tila</th><th>Etusivu</th
					></tr
				>
			</thead>
			<tbody>
				{#each data.events as event (event.id)}
					<tr>
						<td><a href="/dashboard/{data.org.slug}/events/{event.id}">{event.title}</a></td>
						<td>{event.next ? `${formatDate(event.next)} ${formatTime(event.next)}` : '—'}</td>
						<td>{event.recurrence ?? 'Kertaluonteinen'}</td>
						<td><span class="badge {event.status}">{STATUS_LABELS[event.status]}</span></td>
						<td>
							{#if event.frontPageProblems.length}
								<span class="hint">{event.frontPageProblems.join(', ')}</span>
							{:else}
								<span class="ok">✓ Kelpaa</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.usage {
		margin-bottom: 16px;
		background: linear-gradient(90deg, var(--gold-soft), var(--surface));
	}
	.usage p {
		margin: 2px 0 0;
	}
	.ok {
		color: var(--accent-strong);
		font-weight: 600;
		white-space: nowrap;
	}
	.actions {
		display: flex;
		gap: 16px;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
</style>
