import { asc, eq, and, isNull } from 'drizzle-orm';
import { db, findCity, nearestCity } from '$lib/server/platform';
import {
	listLinkedAccounts,
	signInWithExternalAccount,
	type ExternalIdentity,
	type SessionUser,
	type SignInRejection
} from '$lib/server/modules/identity';
import {
	addMember,
	createOrganization,
	requestMembership
} from '$lib/server/modules/organizations';
import {
	churchToolsProvider,
	fetchChurchProfile,
	providerHost,
	type ChurchToolsClient
} from './client';
import { churchtoolsInstances } from './schema';

/** A connected instance, without its client secret. */
export interface ChurchToolsInstance {
	host: string;
	clientId: string;
	/** The organization the church registered, if any. */
	orgId: string | null;
}

/** Selects everything but the secret. */
const columns = {
	host: churchtoolsInstances.host,
	clientId: churchtoolsInstances.clientId,
	orgId: churchtoolsInstances.orgId
};

export async function listInstances(): Promise<ChurchToolsInstance[]> {
	return db.select(columns).from(churchtoolsInstances).orderBy(asc(churchtoolsInstances.host));
}

export async function getInstance(host: string): Promise<ChurchToolsInstance | null> {
	const [row] = await db
		.select(columns)
		.from(churchtoolsInstances)
		.where(eq(churchtoolsInstances.host, host));
	return row ?? null;
}

/** The instance's OAuth client, with its secret, for signing in. */
export async function getClient(host: string): Promise<ChurchToolsClient | null> {
	const [row] = await db
		.select({
			host: churchtoolsInstances.host,
			clientId: churchtoolsInstances.clientId,
			clientSecret: churchtoolsInstances.clientSecret
		})
		.from(churchtoolsInstances)
		.where(eq(churchtoolsInstances.host, host));
	return row ?? null;
}

export async function getInstanceForOrganization(
	orgId: string
): Promise<ChurchToolsInstance | null> {
	const [row] = await db
		.select(columns)
		.from(churchtoolsInstances)
		.where(eq(churchtoolsInstances.orgId, orgId));
	return row ?? null;
}

/** Replaces a connected instance's client (e.g. after it was recreated in ChurchTools). */
async function replaceClient({ host, clientId, clientSecret }: ChurchToolsClient): Promise<void> {
	await db
		.update(churchtoolsInstances)
		.set({ clientId, clientSecret })
		.where(eq(churchtoolsInstances.host, host));
}

/** Removes an instance no organization registered. False if one did (or it doesn't exist). */
export async function removeUnregisteredInstance(host: string): Promise<boolean> {
	const removed = await db
		.delete(churchtoolsInstances)
		.where(and(eq(churchtoolsInstances.host, host), isNull(churchtoolsInstances.orgId)))
		.returning({ host: churchtoolsInstances.host });
	return removed.length > 0;
}

/** Hosts of the ChurchTools instances linked to a user's account. */
export async function listLinkedInstances(userId: string): Promise<string[]> {
	return (await listLinkedAccounts(userId))
		.map(providerHost)
		.filter((host): host is string => host !== null);
}

/** The church's name and address from its ChurchTools, mapped to Nextep's profile fields. */
export async function importChurchProfile(host: string) {
	const profile = await fetchChurchProfile(host);
	const city =
		findCity(profile.city)?.name ??
		(profile.lat !== null && profile.lng !== null
			? nearestCity(profile.lat, profile.lng).name
			: null);
	return { ...profile, city };
}

/**
 * A new church's organization profile from its ChurchTools. Registration never fails on it:
 * without ChurchTools' details the name is the host and the city Helsinki, for the owner to fix.
 */
async function newChurchProfile(host: string) {
	try {
		const p = await importChurchProfile(host);
		return {
			name: p.name ?? host,
			city: p.city ?? 'Helsinki',
			streetAddress: p.streetAddress,
			postalCode: p.postalCode,
			lat: p.lat,
			lng: p.lng
		};
	} catch (err) {
		console.error(`[churchtools] /api/info of ${host} failed`, err);
		return { name: host, city: 'Helsinki' };
	}
}

export type ChurchToolsSignIn =
	| { ok: true; user: SessionUser; registeredOrgSlug: string | null }
	| { ok: false; reason: SignInRejection | 'registered' };

/**
 * After ChurchTools accepted the sign-in with `client`: resolves the user and, when the flow
 * came from /register, registers the church or replaces its client. A working round trip proves
 * the instance's admin created this client for Nextep, so both are safe.
 */
export async function completeSignIn(input: {
	client: ChurchToolsClient;
	identity: ExternalIdentity;
	currentUserId: string | null;
	/** Whether the flow came from /register. */
	registration: boolean;
}): Promise<ChurchToolsSignIn> {
	const { client, identity, currentUserId, registration } = input;
	const { host } = client;
	const instance = await getInstance(host);
	const signIn = await signInWithExternalAccount(
		churchToolsProvider(host),
		identity,
		currentUserId
	);
	if (!signIn.ok) return signIn;
	const user = signIn.user;

	if (registration && !instance?.orgId) {
		const org = await createOrganization({
			...(await newChurchProfile(host)),
			status: 'in_review',
			registeredBy: user.id
		});
		await addMember(org.id, user.id, 'owner');
		// Claims the instance unless another registration got there first. Then this organization
		// stays in review without ChurchTools, for an admin to remove.
		const claimed = await db
			.insert(churchtoolsInstances)
			.values({ ...client, orgId: org.id })
			.onConflictDoUpdate({
				target: churchtoolsInstances.host,
				set: { clientId: client.clientId, clientSecret: client.clientSecret, orgId: org.id },
				setWhere: isNull(churchtoolsInstances.orgId)
			})
			.returning({ host: churchtoolsInstances.host });
		if (claimed.length === 0) return { ok: false, reason: 'registered' };
		return { ok: true, user, registeredOrgSlug: org.slug };
	}

	if (registration) await replaceClient(client);
	// A new ChurchTools account of a registered church asks to join it.
	if (signIn.outcome !== 'existing' && instance?.orgId) {
		await requestMembership(instance.orgId, user.id);
	}
	return { ok: true, user, registeredOrgSlug: null };
}
