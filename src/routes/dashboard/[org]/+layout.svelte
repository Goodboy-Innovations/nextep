<script lang="ts">
	import { page } from '$app/state';
	import { STATUS_LABELS } from '$lib/format';

	let { data, children } = $props();
	const base = $derived(`/dashboard/${data.org.slug}`);
</script>

<div class="org-head">
	<div>
		<h1>{data.org.name}</h1>
		<span class="badge {data.org.status}">{STATUS_LABELS[data.org.status]}</span>
		{#if data.org.status === 'verified'}
			<a href="/o/{data.org.slug}" class="hint">Julkinen sivu →</a>
		{:else}
			<span class="hint">Tapahtumat näkyvät julkisesti, kun organisaatio on vahvistettu.</span>
		{/if}
	</div>
	<nav class="tabs">
		<!-- Event pages belong to the Tapahtumat tab, so it also leads back from them. -->
		<a
			href={base}
			aria-current={page.url.pathname === base || page.url.pathname.startsWith(`${base}/events/`)
				? 'page'
				: undefined}>Tapahtumat</a
		>
		<a
			href="{base}/profile"
			aria-current={page.url.pathname === `${base}/profile` ? 'page' : undefined}>Profiili</a
		>
	</nav>
</div>

{@render children()}

<style>
	.org-head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 20px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 12px;
	}
	.org-head h1 {
		margin-bottom: 4px;
	}
	.tabs {
		display: flex;
		gap: 16px;
	}
	.tabs a[aria-current='page'] {
		font-weight: 700;
		text-decoration: none;
	}
</style>
