<script lang="ts">
	import EventDetail from '$lib/components/events/EventDetail.svelte';

	let { data } = $props();
</script>

<EventDetail {data} />
