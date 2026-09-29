<script lang="ts">
	import { ROLE_LABELS } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Käyttäjät — Nextep</title></svelte:head>

{#if form?.message}<p class="notice">{form.message}</p>{/if}
{#if form?.error}<p class="notice warn">{form.error}</p>{/if}

<div class="admin-grid">
	<form method="POST" action="?/create" class="card">
		<h2>Kutsu käyttäjä</h2>
		<p class="hint">
			Käyttäjä voi kirjautua Googlella tai Microsoftilla tällä sähköpostiosoitteella, ja
			salasanalla, jos asetat sellaisen.
		</p>
		<div class="field"><label for="name">Nimi</label><input id="name" name="name" required /></div>
		<div class="field">
			<label for="email">Sähköposti</label><input id="email" name="email" type="email" required />
		</div>
		<div class="field">
			<label for="password"
				>Alkusalasana <span class="hint">— valinnainen, vähintään 10 merkkiä</span></label
			>
			<input id="password" name="password" type="text" minlength="10" autocomplete="off" />
		</div>
		<div class="field checks">
			<label><input type="checkbox" name="isAdmin" /> Alustan ylläpitäjä</label>
		</div>
		<button type="submit">Kutsu</button>
	</form>

	<form method="POST" action="?/password" class="card">
		<h2>Aseta salasana</h2>
		<div class="field">
			<label for="p-user">Käyttäjä</label>
			<select id="p-user" name="userId">
				{#each data.users as u (u.id)}<option value={u.id}>{u.name} ({u.email})</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="p-password">Uusi salasana <span class="hint">— vähintään 10 merkkiä</span></label>
			<input
				id="p-password"
				name="password"
				type="text"
				minlength="10"
				required
				autocomplete="off"
			/>
		</div>
		<button type="submit">Aseta</button>
	</form>

	<form method="POST" action="?/member" class="card">
		<h2>Lisää jäsen organisaatioon</h2>
		<div class="field">
			<label for="m-email">Käyttäjä</label>
			<select id="m-email" name="email">
				{#each data.users as u (u.id)}<option value={u.email}>{u.name} ({u.email})</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="orgId">Organisaatio</label>
			<select id="orgId" name="orgId">
				{#each data.orgs as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="role">Rooli</label>
			<select id="role" name="role">
				{#each data.roles as r (r)}<option value={r} selected={r === 'owner'}
						>{ROLE_LABELS[r]}</option
					>{/each}
			</select>
		</div>
		<button type="submit">Lisää</button>
	</form>
</div>

<div class="card table-wrap users">
	<table>
		<thead><tr><th>Nimi</th><th>Sähköposti</th><th>Kirjautuminen</th><th></th></tr></thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<td>{u.name}</td>
					<td>{u.email}</td>
					<td
						>{u.providers.length
							? u.providers.map((p) => (p === 'password' ? 'salasana' : p)).join(', ')
							: 'Ei vielä kirjautunut'}</td
					>
					<td>{u.isAdmin ? 'Ylläpitäjä' : ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.admin-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
		margin-bottom: 24px;
	}
</style>
