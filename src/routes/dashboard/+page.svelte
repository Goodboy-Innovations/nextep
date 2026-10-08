<script lang="ts">
	import { ROLE_LABELS, STATUS_LABELS } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>Hallinta — Nextep</title></svelte:head>

<h1>Organisaatiot</h1>
{#each data.pending as org (org.id)}
	<p class="notice">
		Odotat pääsyä organisaatioon <strong>{org.name}</strong>. Sen omistaja tai ylläpitäjä hyväksyy
		pyyntösi.
	</p>
{/each}
{#if data.orgs.length === 0}
	{#if data.pending.length === 0}
		<p class="card muted">
			Et ole vielä minkään organisaation jäsen. Jos seurakuntasi ei ole vielä Nextepissä,
			<a href="/register">rekisteröi se ChurchToolsilla</a>.
		</p>
	{/if}
{:else}
	<div class="stack">
		{#each data.orgs as org (org.id)}
			<a class="card org" href="/dashboard/{org.slug}">
				<strong>{org.name}</strong>
				<span class="muted">{org.city} · {ROLE_LABELS[org.role]}</span>
				<span class="badge {org.status}">{STATUS_LABELS[org.status]}</span>
			</a>
		{/each}
	</div>
{/if}

<style>
	.org {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
		text-decoration: none;
		color: var(--text);
	}
</style>
