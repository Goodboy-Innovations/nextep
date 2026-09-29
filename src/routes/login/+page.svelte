<script lang="ts">
	let { data, form } = $props();
	const query = $derived(data.next ? `?next=${encodeURIComponent(data.next)}` : '');
	const error = $derived(form?.error ?? data.error);
</script>

<svelte:head><title>Kirjaudu — Nextep</title></svelte:head>

<div class="card login">
	<h1>Järjestäjille</h1>
	<p class="muted">Kirjaudu hallitsemaan seurakuntasi tai yhteisösi tapahtumia.</p>
	{#if error}<p class="notice warn">{error}</p>{/if}

	<form method="POST" action={query || undefined}>
		<div class="field">
			<label for="email">Sähköposti</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
			/>
		</div>
		<div class="field">
			<label for="password">Salasana</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		<button type="submit">Kirjaudu</button>
	</form>

	{#if data.providers.length}
		<div class="divider"><span>tai</span></div>
		<div class="providers">
			{#each data.providers as provider (provider.id)}
				<a class="button secondary provider" href="/login/{provider.id}{query}">
					Kirjaudu: {provider.label}
				</a>
			{/each}
		</div>
	{/if}

	<p class="hint">
		Nextep on alpha-vaiheessa: järjestäjät kutsutaan. Tapahtumien selaaminen ei vaadi kirjautumista.
	</p>
</div>

<style>
	.login {
		max-width: 420px;
		margin: 40px auto;
	}
	.divider {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 20px 0 12px;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		border-top: 1px solid var(--border);
	}
	.providers {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 16px;
	}
	.provider {
		justify-content: center;
	}
</style>
