<script lang="ts">
	import EventForm from '$lib/components/events/EventForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Uusi tapahtuma — {data.org.name}</title></svelte:head>

<h2>Uusi tapahtuma</h2>
{#if form?.errors}<p class="notice warn">Tarkista merkityt kentät.</p>{/if}

<form method="POST" enctype="multipart/form-data">
	<EventForm values={form?.values ?? data.values} errors={form?.errors} {...data.options} />
	<div class="submit">
		<!-- Draft first: pressing Enter in a field uses the first submit button. -->
		<button type="submit" class="secondary">Tallenna luonnoksena</button>
		<button type="submit" name="publish" value="1">Julkaise</button>
	</div>
</form>

<style>
	.submit {
		display: flex;
		gap: 12px;
		margin: 16px 0;
	}
</style>
