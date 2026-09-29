<script lang="ts">
	import EventCard from '$lib/components/events/EventCard.svelte';
	import FeaturedCard from '$lib/components/events/FeaturedCard.svelte';
	import PillSearch from '$lib/components/search/PillSearch.svelte';
	import { searchUrl } from '$lib/search';

	let { data } = $props();
	const result = $derived(data.result);
	const [lead, ...rest] = $derived(result.featured);
	/** The featured grid belongs to the first page; later pages continue the list only. */
	const showFeatured = $derived(result.featured.length > 0 && data.page === 1);
</script>

<svelte:head>
	<title>Nextep — hengellisiä tapahtumia läheltäsi</title>
	<meta
		name="description"
		content="Löydä jumalanpalvelukset, rukousillat, nuorten illat ja muut hengelliset tapahtumat läheltäsi."
	/>
</svelte:head>

<section class="hero">
	<span class="eyebrow">Seuraava askel</span>
	<h1>Mitä lähelläsi tapahtuu?</h1>
	<p class="lead">
		Jumalanpalveluksia, rukousiltoja, ylistystä ja yhteyttä. Hae paikan, päivän tai kiinnostuksen
		mukaan.
	</p>
	<PillSearch
		state={data.state}
		pills={data.pills}
		prefPills={data.prefPills}
		options={data.options}
	/>
</section>

{#if result.tier === 'suggestions'}
	<div class="card empty">
		<h2>Mitään ei löytynyt</h2>
		<p class="muted">Kokeile suurempaa etäisyyttä, toista päivää tai poista jokin suodatin.</p>
	</div>
{:else if result.tier === 'all'}
	<p class="notice">Nostetuista ei löytynyt osumia — alla tulokset kaikista tapahtumista.</p>
{/if}

{#if showFeatured}
	<section aria-labelledby="featured-title">
		<div class="section-head">
			<div>
				<span class="eyebrow gold">
					{result.tier === 'suggestions' ? 'Ehdotuksia sinulle' : 'Nostetut'}
				</span>
				<h2 id="featured-title">
					{result.tier === 'suggestions' ? 'Tällä viikolla nostetut' : data.weekLabel}
				</h2>
			</div>
		</div>
		<div class="featured-grid">
			<div class="lead-card"><FeaturedCard event={lead} large /></div>
			{#each rest as event (event.id)}
				<FeaturedCard {event} />
			{/each}
		</div>
		{#if result.tier === 'featured' && !result.list && result.othersTotal > 0}
			<div class="more">
				<a
					class="button secondary"
					href={searchUrl(data.state, { others: true })}
					data-sveltekit-noscroll
				>
					Näytä myös muut tapahtumat ({result.othersTotal} kpl)
				</a>
			</div>
		{/if}
	</section>
{/if}

{#if result.list}
	<section class="list-section">
		{#if result.tier === 'featured'}
			<div class="section-head">
				<h2>Muut tapahtumat</h2>
				<a href={searchUrl(data.state)} data-sveltekit-noscroll>Piilota</a>
			</div>
		{/if}
		{#if result.list.events.length === 0}
			<p class="muted">Ei enempää tapahtumia.</p>
		{:else}
			<div class="list">
				{#each result.list.events as event (event.id)}
					<EventCard {event} />
				{/each}
			</div>
		{/if}
		<nav class="pager">
			{#if data.page > 1}<a
					class="button secondary"
					href={searchUrl(data.state, { page: data.page - 1, others: data.others })}>← Edelliset</a
				>{:else}<span></span>{/if}
			{#if result.list.hasMore}<a
					class="button secondary"
					href={searchUrl(data.state, { page: data.page + 1, others: data.others })}
					>Lisää tapahtumia →</a
				>{/if}
		</nav>
	</section>
{/if}

<section class="cta card">
	<div>
		<h2>Järjestätkö tapahtumia?</h2>
		<p class="muted">
			Seurakunnat ja yhteisöt julkaisevat tapahtumansa Nextepissä kerran — ne näkyvät haussa,
			Googlessa ja kävijöiden omissa kalentereissa.
		</p>
	</div>
	<a class="button" href="/login">Järjestäjille</a>
</section>

<style>
	.hero {
		padding: 28px 0 8px;
		max-width: 820px;
	}
	.lead {
		font-size: 1.12rem;
		color: var(--muted);
		margin: 0 0 20px;
	}
	.eyebrow.gold {
		color: var(--gold);
	}
	.featured-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 18px;
	}
	.lead-card {
		grid-column: span 2;
		grid-row: span 2;
		display: grid;
	}
	.empty {
		text-align: center;
		padding: 36px 16px;
		margin-bottom: 28px;
	}
	.more {
		display: flex;
		justify-content: center;
		margin-top: 22px;
	}
	.list-section {
		margin-top: 36px;
	}
	.list {
		display: grid;
		gap: 12px;
		max-width: 860px;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		max-width: 860px;
		margin: 24px 0 0;
	}
	.cta {
		margin-top: 48px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		flex-wrap: wrap;
		background: linear-gradient(120deg, var(--accent-soft), var(--gold-soft));
		border: none;
	}
	.cta h2 {
		margin-bottom: 4px;
	}
	.cta p {
		margin: 0;
		max-width: 620px;
	}
	@media (max-width: 900px) {
		.featured-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 600px) {
		.featured-grid {
			grid-template-columns: 1fr;
		}
		.lead-card {
			grid-column: auto;
			grid-row: auto;
		}
	}
</style>
