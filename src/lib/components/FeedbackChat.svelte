<script lang="ts">
	// Feedback chat (<feedback-chat>, its own shadow DOM). It talks to our /api/feedback proxy,
	// which forwards to the hosted feedback-chat server. Loaded in the browser only, so seekers who aren't signed in never download it.
	let { endpoint, userName }: { endpoint: string; userName?: string } = $props();

	$effect(() => {
		const options = { endpoint, project: 'nextep', userName, locale: 'fi', accent: '#2b6a55' };
		let remove: (() => void) | undefined;
		let cancelled = false;
		import('@feedback-chat/widget').then(({ mount }) => {
			if (!cancelled) remove = mount(options);
		});
		return () => {
			cancelled = true;
			remove?.();
		};
	});
</script>
