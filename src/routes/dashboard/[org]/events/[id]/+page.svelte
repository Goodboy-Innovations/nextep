<script lang="ts">
	import { page } from '$app/state';
	import EventForm from '$lib/components/events/EventForm.svelte';
	import { STATUS_LABELS, formatTimeRange, relativeDay } from '$lib/format';

	let { data, form } = $props();
	const event = $derived(data.event);
	const publicUrl = $derived(`/e/${data.org.slug}/${event.slug}`);
	const saved = $derived(form?.saved || page.url.searchParams.has('saved'));
	const imageError = $derived(page.url.searchParams.get('imageError'));
</script>

<svelte:head><title>{event.title} — {data.org.name}</title></svelte:head>

<div class="head">
	<div>
		<h2>{event.title}</h2>
		<span class="badge {event.status}">{STATUS_LABELS[event.status]}</span>
		{#if event.status !== 'draft' && data.org.status === 'verified'}
			<a class="hint" href={publicUrl}>Näytä julkinen sivu →</a>
		{/if}
	</div>
	<form method="POST" action="?/status" class="status-actions">
		{#if event.status !== 'published'}
			<button name="status" value="published">Julkaise</button>
		{/if}
		{#if event.status === 'published'}
			<button name="status" value="cancelled" class="danger">Peru tapahtuma</button>
			<button name="status" value="draft" class="secondary">Palauta luonnokseksi</button>
		{/if}
	</form>
</div>

{#if saved}<p class="notice">Tallennettu.</p>{/if}
{#if imageError}<p class="notice warn">
		Tapahtuma tallennettiin, mutta kuvaa ei: {imageError}
	</p>{/if}
{#if form?.errors}<p class="notice warn">Tarkista merkityt kentät.</p>{/if}

<div class="edit-layout">
	<form method="POST" action="?/save" enctype="multipart/form-data">
		<EventForm
			values={form?.values ?? data.form}
			errors={form?.errors}
			image={data.image}
			{...data.options}
		/>
		<p><button type="submit">Tallenna muutokset</button></p>
	</form>

	<aside class="stack">
		{#if data.frontPage}
			{@const ok = data.frontPage.problems.length === 0}
			<div class="card front-page" class:ok>
				<h3>Etusivu</h3>
				{#if ok}
					<p><strong>✓ Tapahtuma pääsee etusivulle.</strong></p>
				{:else}
					<p class="hint"><strong>Jotta tapahtuma pääsee etusivulle:</strong></p>
					<ul class="problems">
						{#each data.frontPage.problems as problem (problem)}<li>{problem}</li>{/each}
					</ul>
				{/if}
				<p class="hint">
					Etusivulla näkyvät kunkin viikon laadukkaat tapahtumat, organisaatioltanne enintään
					{data.frontPage.limit} samalta viikolta. Kävijä näkee niistä hänelle parhaiten sopivat.
				</p>
			</div>
		{/if}
		{#if event.rrule}
			<div class="card">
				<h3>Tulevat kerrat</h3>
				<p class="hint">Peru yksittäinen kerta ilman, että koko sarja muuttuu.</p>
				<ul class="dates">
					{#each data.upcoming as o (o.localDate)}
						<li class:cancelled={o.cancelled}>
							<span>{relativeDay(o.startsAt)} {formatTimeRange(o.startsAt, o.endsAt)}</span>
							<form method="POST" action="?/occurrence">
								<input type="hidden" name="date" value={o.localDate} />
								{#if o.cancelled}
									<button class="link-button" name="cancelled" value="0">Palauta</button>
								{:else}
									<button class="link-button" name="cancelled" value="1">Peru</button>
								{/if}
							</form>
						</li>
					{:else}
						<li class="muted">Ei tulevia kertoja.</li>
					{/each}
				</ul>
			</div>
		{/if}
		<div class="card">
			<h3>Kalenteri</h3>
			<p class="hint">iCalendar UID: <code>{event.uid}</code></p>
		</div>
		{#if data.role === 'admin' || data.role === 'owner'}
			<form
				method="POST"
				action="?/delete"
				onsubmit={(e) => {
					if (!confirm('Poistetaanko tapahtuma pysyvästi?')) e.preventDefault();
				}}
			>
				<button class="danger">Poista tapahtuma</button>
			</form>
		{/if}
	</aside>
</div>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: start;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 16px;
	}
	.status-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.edit-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 24px;
		align-items: start;
	}
	.dates {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.dates li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}
	.dates li.cancelled span {
		text-decoration: line-through;
		color: var(--muted);
	}
	.dates form {
		margin: 0;
	}
	code {
		word-break: break-all;
	}
	.front-page.ok {
		border-color: var(--gold-soft);
		background: linear-gradient(180deg, var(--gold-soft), var(--surface) 120px);
	}
	.front-page p {
		margin: 0 0 8px;
	}
	.problems {
		margin: 0 0 10px;
		padding-left: 18px;
		color: var(--warn);
		font-size: 0.9rem;
	}
	@media (max-width: 860px) {
		.edit-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
