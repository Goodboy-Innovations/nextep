<script lang="ts">
	// The church's ChurchTools address: only the subdomain is typed, ".church.tools" is fixed.
	// A pasted full address works too; the server strips it. `bind:value` to follow what is typed.
	let {
		id = 'instance',
		name = 'instance',
		value = $bindable(''),
		label = 'Seurakuntasi ChurchTools-osoite'
	}: { id?: string; name?: string; value?: string; label?: string } = $props();
</script>

<div class="field">
	<label for={id}>{label}</label>
	<div class="address">
		<input
			{id}
			{name}
			bind:value
			placeholder="seurakunta"
			autocapitalize="none"
			autocomplete="off"
			spellcheck="false"
			required
			aria-describedby="{id}-suffix"
		/>
		<span class="suffix" id="{id}-suffix">.church.tools</span>
	</div>
</div>

<style>
	.address {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		background: var(--surface);
		overflow: hidden;
	}
	.address:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	.address input {
		flex: 1;
		min-width: 0;
		border: none;
		border-radius: 0;
		padding-right: 1px;
		text-align: right;
	}
	/* The whole field shows focus instead. */
	.address input:focus-visible {
		outline: none;
	}
	.suffix {
		display: flex;
		align-items: center;
		padding-right: 12px;
		white-space: nowrap;
		user-select: none;
		font-weight: 500;
	}
</style>
