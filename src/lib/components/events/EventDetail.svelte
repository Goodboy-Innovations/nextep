<script lang="ts">
	import { formatLongDate, formatTimeRange, relativeDay } from '$lib/format';
	import type { loadEventPage } from '$lib/server/pages/event-page';

	let { data }: { data: Awaited<ReturnType<typeof loadEventPage>> } = $props();
	const event = $derived(data.event);
	const org = $derived(data.org);
	const occ = $derived(data.occurrence);
	const address = $derived(
		[event.venueName, event.streetAddress, event.city].filter(Boolean).join(', ')
	);
	const mapUrl = $derived(
		`https://www.openstreetmap.org/?mlat=${event.lat}&mlon=${event.lng}#map=16/${event.lat}/${event.lng}`
	);
	const isPast = $derived(occ ? occ.endsAt.getTime() < Date.now() : true);
</script>

<svelte:head>
	<title>{event.title} — {org.name} | Nextep</title>
	<meta name="description" content={event.extract || event.description.slice(0, 160)} />
	<link rel="canonical" href={data.canonical} />
	<meta property="og:title" content={event.title} />
	<meta property="og:description" content={event.extract} />
	<meta property="og:type" content="website" />
	{#if data.ogImage}<meta property="og:image" content={data.ogImage} />{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON is escaped in seo.eventJsonLd -->
	{@html `<script type="application/ld+json">${data.jsonLd}</` + 'script>'}
</svelte:head>

{#if data.image}
	<img class="hero-image" src={data.image} alt="" />
{/if}

<article class="event-layout">
	<div>
		<p class="muted org-line"><a href="/o/{org.slug}">{org.name}</a></p>
		<h1>{event.title}</h1>
		{#if event.status === 'cancelled'}
			<p class="notice warn">Tapahtuma on peruttu.</p>
		{/if}
		{#if event.extract}<p class="lead">{event.extract}</p>{/if}
		<div class="tags">
			{#each data.tags as tag (tag.kind + tag.slug)}<span class="tag">{tag.label}</span>{/each}
		</div>
		{#if event.description}<div class="description">{event.description}</div>{/if}
	</div>

	<aside class="card stack">
		{#if occ}
			<div>
				<div class="big-date">{formatLongDate(occ.startsAt)}</div>
				<div>klo {formatTimeRange(occ.startsAt, occ.endsAt)}</div>
				{#if isPast}<div class="muted">Tämä ajankohta on mennyt.</div>{/if}
				{#if data.recurrence}<div class="muted">↻ {data.recurrence}</div>{/if}
			</div>
		{/if}
		<div>
			<strong>Paikka</strong>
			<div>{address}</div>
			<a href={mapUrl} rel="noopener" target="_blank">Näytä kartalla</a>
		</div>
		{#if event.url}
			<div>
				<a href={event.url} rel="noopener" target="_blank">Lisätietoja ja ilmoittautuminen</a>
			</div>
		{/if}
		<a class="button" href="{data.basePath}/calendar.ics" data-sveltekit-reload download
			>Lisää kalenteriin</a
		>

		{#if data.upcoming.length > 1}
			<div>
				<strong>Tulevat kerrat</strong>
				<ul class="dates">
					{#each data.upcoming as o (o.localDate)}
						<li>
							<a href="{data.basePath}/{o.localDate}" aria-current={o.localDate === occ?.localDate}>
								{relativeDay(o.startsAt)}
								{formatTimeRange(o.startsAt, o.endsAt)}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</aside>
</article>

<style>
	.hero-image {
		width: 100%;
		max-height: 420px;
		object-fit: cover;
		border-radius: 18px;
		margin-bottom: 24px;
		box-shadow: var(--shadow);
	}
	.event-layout {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 32px;
		align-items: start;
	}
	.org-line {
		margin: 0 0 4px;
	}
	h1 {
		font-size: clamp(1.6rem, 4vw, 2.2rem);
	}
	.lead {
		font-size: 1.15rem;
	}
	.tags {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 20px;
	}
	.description {
		white-space: pre-line;
		font-size: 1.05rem;
		max-width: 68ch;
	}
	.big-date {
		font-size: 1.15rem;
		font-weight: 700;
		text-transform: capitalize;
	}
	.dates {
		list-style: none;
		padding: 0;
		margin: 6px 0 0;
	}
	.dates a[aria-current='true'] {
		font-weight: 700;
	}
	@media (max-width: 800px) {
		.event-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
