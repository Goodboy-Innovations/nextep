<script lang="ts">
	// Fills the profile form from the church's ChurchTools. Goes inside the profile form; the
	// page's `churchtools` action returns the values, nothing is saved until the form is.
	let { host }: { host: string } = $props();
</script>

<div class="autofill">
	<button formaction="?/churchtools" formnovalidate class="secondary">
		Hae tiedot ChurchToolsista
	</button>
	<span class="hint">Nimi ja osoite osoitteesta {host}</span>
</div>

<style>
	.autofill {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
</style>
