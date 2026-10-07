<script lang="ts">
	import ChurchToolsConnect from '$lib/components/churchtools/ChurchToolsConnect.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Oma tili — Nextep</title></svelte:head>

<div class="account">
	<h1>Oma tili</h1>
	<p class="muted">{data.user?.name} · {data.user?.email}</p>

	{#if data.connected}<p class="notice">
			ChurchTools ({data.connected}) on nyt liitetty tiliisi.
		</p>{/if}
	{#if data.error}
		<p class="notice warn">
			{data.error}
			{#if data.unknownInstance}<a href="/register?instance={encodeURIComponent(data.connect)}"
					>Rekisteröi seurakuntasi</a
				>{/if}
		</p>
	{/if}

	<div class="card">
		<h2>Kirjautumistavat</h2>
		<ul>
			<li>Sähköposti ja salasana: {data.password ? 'käytössä' : 'ei käytössä'}</li>
			{#each data.churchTools as host (host)}
				<li>ChurchTools: {host}</li>
			{:else}
				<li class="muted">Ei ChurchTools-kirjautumista</li>
			{/each}
		</ul>

		<ChurchToolsConnect connect={data.connect} />
	</div>
</div>

<style>
	.account {
		max-width: 560px;
		margin: 24px auto;
	}
</style>
