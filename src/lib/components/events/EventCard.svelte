<script lang="ts">
	import { dateParts, formatDistance, formatTimeRange, relativeDay } from '$lib/format';

	interface Props {
		event: {
			slug: string;
			title: string;
			extract: string;
			city: string;
			venueName: string | null;
			image?: string | null;
			orgSlug: string;
			orgName: string;
			startsAt: Date;
			endsAt: Date;
			localDate: string;
			recurrence: string | null;
			distanceKm?: number | null;
			tags: { kind: string; label: string }[];
		};
	}

	let { event }: Props = $props();
	const href = $derived(
		event.recurrence
			? `/e/${event.orgSlug}/${event.slug}/${event.localDate}`
			: `/e/${event.orgSlug}/${event.slug}`
	);
	const distance = $derived(formatDistance(event.distanceKm ?? null));
	const parts = $derived(dateParts(event.startsAt));
</script>

<article class="event-card" class:has-image={!!event.image}>
	<div class="date" aria-hidden="true">
		<span class="weekday">{parts.weekday}</span>
		<span class="day">{parts.day}</span>
		<span class="month">{parts.month}</span>
	</div>
	<div class="body">
		<p class="when">
			<strong>{relativeDay(event.startsAt)}</strong>
			{formatTimeRange(event.startsAt, event.endsAt)}
			{#if distance}<span class="distance">· {distance}</span>{/if}
		</p>
		<h3><a {href}>{event.title}</a></h3>
		<p class="meta">
			{event.orgName} · {event.venueName ? `${event.venueName}, ` : ''}{event.city}
		</p>
		{#if event.extract}<p class="extract">{event.extract}</p>{/if}
		<div class="tags">
			{#if event.recurrence}<span class="tag recurring">↻ {event.recurrence}</span>{/if}
			{#each event.tags.filter((t) => t.kind !== 'denomination') as tag (tag.label)}
				<span class="tag">{tag.label}</span>
			{/each}
		</div>
	</div>
	{#if event.image}
		<img class="thumb" src={event.image} alt="" loading="lazy" />
	{/if}
</article>

<style>
	.event-card {
		position: relative;
		display: grid;
		grid-template-columns: 64px 1fr;
		gap: 16px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		transition:
			box-shadow 0.15s,
			border-color 0.15s,
			transform 0.15s;
	}
	.event-card.has-image {
		grid-template-columns: 64px 1fr 132px;
	}
	.event-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-lg);
		transform: translateY(-1px);
	}
	.date {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		align-self: start;
		padding: 8px 0;
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--accent-strong);
		line-height: 1.1;
	}
	.weekday,
	.month {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.day {
		font-size: 1.5rem;
		font-weight: 800;
	}
	.when {
		margin: 0 0 2px;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.when strong {
		color: var(--text);
	}
	h3 {
		font-size: 1.12rem;
		margin: 0 0 2px;
	}
	/* The title link covers the whole card. */
	h3 a {
		color: var(--text);
		text-decoration: none;
	}
	h3 a::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
	}
	h3 a:focus-visible {
		outline: none;
	}
	h3 a:focus-visible::after {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.meta {
		margin: 0 0 6px;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.extract {
		margin: 0 0 10px;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.recurring {
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
	.thumb {
		width: 132px;
		height: 100px;
		object-fit: cover;
		border-radius: 10px;
		align-self: start;
	}
	@media (max-width: 560px) {
		.event-card,
		.event-card.has-image {
			grid-template-columns: 56px 1fr;
		}
		.thumb {
			display: none;
		}
	}
</style>
