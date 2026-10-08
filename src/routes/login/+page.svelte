<script lang="ts">
	import ChurchToolsSignIn from '$lib/components/churchtools/ChurchToolsSignIn.svelte';

	let { data, form } = $props();
	const query = $derived(data.next ? `?next=${encodeURIComponent(data.next)}` : '');
	const error = $derived(form?.error ?? data.error);
</script>

<svelte:head><title>Kirjaudu — Nextep</title></svelte:head>

<div class="card login">
	<h1>Järjestäjille</h1>
	<p class="muted">Kirjaudu hallitsemaan seurakuntasi tai yhteisösi tapahtumia.</p>
	{#if error}
		<p class="notice warn">
			{error}
			{#if data.unknownInstance}<a href="/register?instance={encodeURIComponent(data.instance)}"
					>Rekisteröi seurakuntasi</a
				>{/if}
		</p>
	{/if}

	<ChurchToolsSignIn instance={data.instance} next={data.next} />

	<div class="divider"><span>tai sähköpostilla</span></div>

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
		<button type="submit" class="secondary">Kirjaudu</button>
	</form>

	<p class="hint">
		Seurakuntasi ei ole vielä Nextepissä? <a href="/register">Rekisteröi se ChurchToolsilla</a>.
		Tapahtumien selaaminen ei vaadi kirjautumista.
	</p>
</div>

<style>
	.login {
		max-width: 420px;
		margin: 40px auto;
	}
	.login form {
		margin-bottom: 16px;
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
</style>
