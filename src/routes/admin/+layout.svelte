<script lang="ts">
	let { children } = $props();
</script>

<nav class="admin-nav">
	<strong>Ylläpito</strong>
	<a href="/admin">Organisaatiot</a>
	<a href="/admin/users">Käyttäjät</a>
</nav>

{@render children()}

<style>
	.admin-nav {
		display: flex;
		gap: 16px;
		margin-bottom: 20px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border);
	}
</style>
