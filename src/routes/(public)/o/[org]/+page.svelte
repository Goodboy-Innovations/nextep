<script lang="ts">
	import EventCard from '$lib/components/events/EventCard.svelte';

	let { data } = $props();
	const org = $derived(data.org);
	const webcal = $derived(data.feedUrl.replace(/^https?:/, 'webcal:'));
</script>

<svelte:head>
	<title>{org.name} — Nextep</title>
	<meta
		name="description"
		content={org.description.slice(0, 160) || `${org.name}: tulevat tapahtumat`}
	/>
	<link rel="canonical" href={data.canonical} />
</svelte:head>

<div class="org-layout">
	<section>
		<h1>{org.name}</h1>
		{#if org.description}<p class="description">{org.description}</p>{/if}

		<h2>Tulevat tapahtumat</h2>
		{#if data.events.length === 0}
			<p class="muted">Ei tulevia tapahtumia.</p>
		{:else}
			<div class="stack">
				{#each data.events as event (event.id)}
					<EventCard event={{ ...event, orgSlug: org.slug, orgName: org.name }} />
				{/each}
			</div>
		{/if}
	</section>

	<aside class="card stack">
		<div>
			<h3>Yhteystiedot</h3>
			<p>
				{#if org.streetAddress}{org.streetAddress}<br />{/if}
				{org.postalCode ?? ''}
				{org.city}
			</p>
			{#if org.website}<p>
					<a href={org.website} rel="noopener">{org.website.replace(/^https?:\/\//, '')}</a>
				</p>{/if}
			{#if org.email}<p><a href="mailto:{org.email}">{org.email}</a></p>{/if}
			{#if org.phone}<p>{org.phone}</p>{/if}
		</div>
		<div>
			<h3>Tilaa kalenteri</h3>
			<p class="muted">Näe kaikki tapahtumat omassa kalenterissasi (Google, Apple, Outlook).</p>
			<a class="button secondary" href={webcal}>Tilaa kalenteri</a>
			<p class="hint">Tai kopioi osoite: <code>{data.feedUrl}</code></p>
		</div>
	</aside>
</div>

<style>
	.org-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 24px;
		align-items: start;
	}
	.description {
		white-space: pre-line;
		margin-bottom: 24px;
	}
	code {
		word-break: break-all;
	}
	@media (max-width: 800px) {
		.org-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
