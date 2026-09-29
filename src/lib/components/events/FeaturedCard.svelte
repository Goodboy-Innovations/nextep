<script lang="ts">
	import { formatDistance, formatTimeRange, relativeDay } from '$lib/format';

	interface Props {
		event: {
			slug: string;
			title: string;
			extract: string;
			city: string;
			venueName: string | null;
			image: string | null;
			orgSlug: string;
			orgName: string;
			startsAt: Date;
			endsAt: Date;
			localDate: string;
			recurrence: string | null;
			distanceKm?: number | null;
		};
		large?: boolean;
	}

	let { event, large = false }: Props = $props();
	const href = $derived(
		event.recurrence
			? `/e/${event.orgSlug}/${event.slug}/${event.localDate}`
			: `/e/${event.orgSlug}/${event.slug}`
	);
	const distance = $derived(formatDistance(event.distanceKm ?? null));
</script>

<article class="featured" class:large>
	<div class="media">
		{#if event.image}<img src={event.image} alt="" loading="lazy" />{/if}
		<span class="when-badge">
			<strong>{relativeDay(event.startsAt)}</strong>
			{formatTimeRange(event.startsAt, event.endsAt)}
		</span>
	</div>
	<div class="body">
		<p class="org">{event.orgName}</p>
		<h3><a {href}>{event.title}</a></h3>
		{#if event.extract}<p class="extract">{event.extract}</p>{/if}
		<p class="place">
			📍 {event.venueName ? `${event.venueName}, ` : ''}{event.city}{distance
				? ` · ${distance}`
				: ''}
		</p>
	</div>
</article>

<style>
	.featured {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 18px;
		overflow: hidden;
		box-shadow: var(--shadow);
		transition:
			box-shadow 0.15s,
			transform 0.15s;
	}
	.featured:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-2px);
	}
	.media {
		position: relative;
		aspect-ratio: 16 / 9;
		background: linear-gradient(135deg, var(--accent-soft), var(--gold-soft));
	}
	.large .media {
		aspect-ratio: 16 / 8;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.when-badge {
		position: absolute;
		left: 12px;
		bottom: 12px;
		padding: 5px 10px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.92);
		font-size: 0.85rem;
		color: var(--text);
		box-shadow: var(--shadow);
	}
	.body {
		padding: 14px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}
	.org {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent);
	}
	h3 {
		margin: 0;
		font-size: 1.2rem;
	}
	.large h3 {
		font-size: 1.5rem;
	}
	h3 a {
		color: var(--text);
		text-decoration: none;
	}
	h3 a::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	h3 a:focus-visible {
		outline: none;
	}
	h3 a:focus-visible::after {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: 18px;
	}
	.extract {
		margin: 2px 0 6px;
		color: var(--text);
	}
	.place {
		margin: auto 0 0;
		font-size: 0.9rem;
		color: var(--muted);
	}
</style>
