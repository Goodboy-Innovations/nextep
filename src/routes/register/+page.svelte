<script lang="ts">
	import ChurchToolsInput from '$lib/components/churchtools/ChurchToolsInput.svelte';

	let { data, form } = $props();
	const error = $derived(form?.error ?? data.error);

	// Starts from what was submitted (each submit reloads the page), then follows typing.
	// svelte-ignore state_referenced_locally
	let instance = $state(form?.instance ?? data.instance);

	/** The typed subdomain, as the server reads it ("utopia", "utopia.church.tools", a URL). */
	const subdomain = $derived.by(() => {
		const host = instance
			.trim()
			.toLowerCase()
			.replace(/^[a-z]+:\/\//, '')
			.split(/[/?#]/)[0]
			.replace(/\.church\.tools$/, '');
		return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(host) ? host : null;
	});
	const settingsURL = $derived(
		subdomain ? `https://${subdomain}.church.tools/settings/system/general/login` : null
	);

	let copied = $state(false);
	let redirectCode: HTMLElement;
	async function copyRedirectURI() {
		try {
			await navigator.clipboard.writeText(data.redirectURI);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard access: select the text for Ctrl+C instead.
			getSelection()?.selectAllChildren(redirectCode);
		}
	}
</script>

<svelte:head><title>Rekisteröi seurakunta — Nextep</title></svelte:head>

<div class="register">
	<h1>Rekisteröi seurakuntasi</h1>
	<p class="muted">
		Seurakunnat liittyvät Nextepiin ChurchToolsin kautta. Tähän tarvitaan seurakuntasi ChurchToolsin
		ylläpitäjä. Rekisteröinnin jälkeen tarkistamme seurakunnan, ja sen tapahtumat tulevat
		julkisiksi, kun se on vahvistettu.
	</p>
	{#if error}<p class="notice warn">{error}</p>{/if}

	<form method="POST" class="card">
		{#if data.signedInAs}
			<p class="hint">
				Olet kirjautunut tunnuksella {data.signedInAs}. ChurchTools-kirjautuminen liitetään tähän
				tiliin, ja sinusta tulee seurakunnan omistaja.
			</p>
		{/if}

		<ol class="flow">
			<li>
				<ChurchToolsInput bind:value={instance} />
			</li>

			<li>
				<p>
					Avaa ChurchToolsin kirjautumisasetukset:
					{#if settingsURL}
						<a href={settingsURL} target="_blank" rel="noopener noreferrer">{settingsURL} ↗</a>
					{:else}
						<span class="muted">kirjoita ensin osoite, niin linkki ilmestyy tähän.</span>
					{/if}
				</p>
				<p class="hint">
					Järjestelmäasetukset → Yleinen → Kirjaudu sisään → Kirjaudu kolmannen osapuolen
					järjestelmään ChurchTools-käyttäjätilillä
				</p>
			</li>

			<li>
				<p>
					Lisää OAuth-asiakas nimellä <code>Nextep</code> ja kopioi ChurchToolsin näyttämä salaisuus
					tähän. <strong>ChurchTools näyttää sen vain kerran.</strong>
				</p>
				<div class="field">
					<label for="clientSecret">Asiakkaan salaisuus</label>
					<input
						id="clientSecret"
						name="clientSecret"
						type="password"
						autocomplete="off"
						spellcheck="false"
						required
						value={form?.clientSecret ?? ''}
					/>
				</div>
			</li>

			<li>
				<p>Aseta asiakkaan asetuksissa Ohjaus-URI:</p>
				<div class="copy">
					<code bind:this={redirectCode}>{data.redirectURI}</code>
					<button type="button" class="secondary small" onclick={copyRedirectURI}>
						{copied ? 'Kopioitu ✓' : 'Kopioi'}
					</button>
				</div>
			</li>

			<li>
				<p>Kopioi samalta sivulta asiakkaan tunnus tähän.</p>
				<div class="field">
					<label for="clientId">Asiakkaan tunnus</label>
					<input
						id="clientId"
						name="clientId"
						autocomplete="off"
						spellcheck="false"
						required
						value={form?.clientId ?? ''}
					/>
				</div>
			</li>
		</ol>

		<button type="submit">Kirjaudu ChurchToolsilla ja rekisteröi</button>
		<p class="hint">
			Kirjaudut omalla ChurchTools-tunnuksellasi, ja sinusta tulee seurakunnan omistaja Nextepissä.
			Seurakunnan nimi ja osoite haetaan ChurchToolsista, ja voit muokata niitä profiilissa. Muut
			seurakuntasi jäsenet voivat myöhemmin pyytää pääsyä, ja sinä hyväksyt heidät. Jos seurakunta
			on jo Nextepissä, rekisteröinti vain ottaa uuden asiakkaan käyttöön.
		</p>
	</form>
</div>

<style>
	.register {
		max-width: 640px;
		margin: 24px auto;
	}
	.flow {
		list-style: none;
		counter-reset: step;
		padding: 0;
		margin: 0 0 20px;
	}
	.flow > li {
		counter-increment: step;
		position: relative;
		padding: 0 0 20px 40px;
		margin: 0 0 20px;
		border-bottom: 1px solid var(--border);
	}
	.flow > li::before {
		content: counter(step);
		position: absolute;
		left: 0;
		top: 0;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 700;
		font-size: 0.9rem;
		display: grid;
		place-items: center;
	}
	.flow p {
		margin: 2px 0 10px;
	}
	.flow a {
		word-break: break-all;
	}
	.copy {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	code {
		word-break: break-all;
	}
	.small {
		padding: 4px 10px;
		font-size: 0.85rem;
		flex-shrink: 0;
	}
</style>
