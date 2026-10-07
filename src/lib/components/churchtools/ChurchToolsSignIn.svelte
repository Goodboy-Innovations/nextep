<script lang="ts">
	// Sign-in with the church's ChurchTools, for the login page.
	import ChurchToolsInput from './ChurchToolsInput.svelte';

	let { instance = '', next = null }: { instance?: string; next?: string | null } = $props();
</script>

<form method="GET" action="/login/churchtools">
	<ChurchToolsInput value={instance} />
	{#if next}<input type="hidden" name="next" value={next} />{/if}
	<button type="submit">Kirjaudu ChurchToolsilla</button>
</form>

<style>
	form {
		margin-bottom: 16px;
	}
</style>
