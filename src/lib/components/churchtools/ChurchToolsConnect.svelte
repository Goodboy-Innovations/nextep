<script lang="ts">
	// Connects (another) ChurchTools to the signed-in account, for the account page.
	import ChurchToolsInput from './ChurchToolsInput.svelte';

	/** Subdomain to connect, after "sign in to your account first" (?connect=). */
	let { connect = '' }: { connect?: string } = $props();
</script>

<form method="GET" action="/login/churchtools" class:highlight={!!connect}>
	<h3>Liitä ChurchTools</h3>
	{#if connect}
		<p class="hint">Kirjaudu ChurchToolsiin, niin voit jatkossa kirjautua Nextepiin myös sillä.</p>
	{/if}
	<ChurchToolsInput value={connect} label="ChurchTools-osoite" />
	<input type="hidden" name="next" value="/account" />
	<button type="submit">Liitä ChurchTools</button>
</form>

<style>
	form {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}
	.highlight {
		border-top-color: var(--accent);
	}
</style>
