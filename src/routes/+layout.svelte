<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#fbfaf7" />
</svelte:head>

<header class="site-header">
	<div class="container bar">
		<a href="/" class="brand">
			<span class="mark" aria-hidden="true">›</span>Nextep<span class="beta">alpha</span>
		</a>
		<nav>
			<a href="/?muut=1">Kaikki tapahtumat</a>
			{#if data.user}
				<a href="/dashboard">Hallinta</a>
				{#if data.user.isAdmin}<a href="/admin">Ylläpito</a>{/if}
				<form method="POST" action="/logout">
					<button class="link-button">Kirjaudu ulos</button>
				</form>
			{:else}
				<a href="/login" class="button secondary small">Järjestäjille</a>
			{/if}
		</nav>
	</div>
</header>

<main class="container">
	{@render children()}
</main>

<footer class="site-footer">
	<div class="container footer-inner">
		<div>
			<strong>Nextep</strong> — seuraava askel.<br />
			<span class="muted">Hengelliset tapahtumat läheltäsi, yhdestä paikasta.</span>
		</div>
		<nav class="muted">
			<a href="/">Tapahtumat</a>
			<a href="/login">Järjestäjille</a>
		</nav>
	</div>
</footer>

<style>
	.site-header {
		background: rgb(255 255 255 / 0.85);
		backdrop-filter: saturate(1.2) blur(8px);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 30;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 60px;
		gap: 12px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 800;
		font-size: 1.3rem;
		letter-spacing: -0.02em;
		text-decoration: none;
		color: var(--text);
	}
	.mark {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background: var(--accent);
		color: #fff;
		font-size: 1.3rem;
		line-height: 1;
		padding-bottom: 3px;
	}
	.beta {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		align-self: flex-start;
		margin-top: 6px;
		color: var(--gold);
	}
	nav {
		display: flex;
		gap: 18px;
		align-items: center;
		flex-wrap: wrap;
	}
	nav a:not(.button) {
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
	}
	nav a:not(.button):hover {
		color: var(--accent);
	}
	nav form {
		margin: 0;
	}
	.small {
		padding: 6px 12px;
		font-size: 0.9rem;
	}
	main {
		min-height: 70vh;
		padding-top: 24px;
		padding-bottom: 48px;
	}
	.site-footer {
		border-top: 1px solid var(--border);
		background: var(--surface);
		padding: 28px 0;
		font-size: 0.92rem;
	}
	.footer-inner {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.footer-inner nav a {
		color: var(--muted);
	}
	@media (max-width: 560px) {
		nav {
			gap: 12px;
			font-size: 0.92rem;
		}
	}
</style>
