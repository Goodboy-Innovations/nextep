import { and, asc, eq, sql } from 'drizzle-orm';
import { db, findCity, uniqueSlug } from '$lib/server/platform';
import { users } from '../identity/schema';
import {
	ORG_ROLES,
	membershipRequests,
	memberships,
	organizations,
	type OrgRole,
	type OrgStatus
} from './schema';

export type Organization = typeof organizations.$inferSelect;

export interface OrgProfileInput {
	name: string;
	description?: string;
	businessId?: string | null;
	email?: string | null;
	phone?: string | null;
	website?: string | null;
	streetAddress?: string | null;
	postalCode?: string | null;
	city: string;
	/** Exact coordinates; when missing, the city centre is used. */
	lat?: number | null;
	lng?: number | null;
}

function resolveLocation(input: OrgProfileInput) {
	if (input.lat != null && input.lng != null) return { lat: input.lat, lng: input.lng };
	const city = findCity(input.city);
	if (!city) throw new Error(`Unknown city "${input.city}" and no coordinates given`);
	return { lat: city.lat, lng: city.lng };
}

export async function createOrganization(
	input: OrgProfileInput & {
		status?: OrgStatus;
		registeredBy?: string | null;
	}
): Promise<Organization> {
	const slug = await uniqueSlug(input.name, async (s) => !!(await getOrganizationBySlug(s)));
	const [org] = await db
		.insert(organizations)
		.values({ ...input, ...resolveLocation(input), slug, status: input.status ?? 'draft' })
		.returning();
	return org;
}

export async function updateOrganization(id: string, input: OrgProfileInput): Promise<void> {
	await db
		.update(organizations)
		.set({ ...input, ...resolveLocation(input), updatedAt: new Date() })
		.where(eq(organizations.id, id));
}

export async function setOrganizationStatus(id: string, status: OrgStatus): Promise<void> {
	await db
		.update(organizations)
		.set({ status, updatedAt: new Date() })
		.where(eq(organizations.id, id));
}

/** How many events the organization can have on the front page per week (admins only). */
export async function setFrontPageLimit(id: string, limit: number): Promise<void> {
	await db
		.update(organizations)
		.set({ frontPageLimit: limit, updatedAt: new Date() })
		.where(eq(organizations.id, id));
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
	const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
	return org ?? null;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
	const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
	return org ?? null;
}

/** Only verified organizations are visible to the public. */
export async function getPublicOrganization(slug: string): Promise<Organization | null> {
	const org = await getOrganizationBySlug(slug);
	return org?.status === 'verified' ? org : null;
}

export async function listOrganizations(): Promise<Organization[]> {
	return db.select().from(organizations).orderBy(asc(organizations.name));
}

export async function listVerifiedOrganizations(): Promise<Organization[]> {
	return db
		.select()
		.from(organizations)
		.where(eq(organizations.status, 'verified'))
		.orderBy(asc(organizations.name));
}

export async function listOrganizationsForUser(
	userId: string
): Promise<(Organization & { role: OrgRole })[]> {
	const rows = await db
		.select({ org: organizations, role: memberships.role })
		.from(memberships)
		.innerJoin(organizations, eq(organizations.id, memberships.orgId))
		.where(eq(memberships.userId, userId))
		.orderBy(asc(organizations.name));
	return rows.map((r) => ({ ...r.org, role: r.role }));
}

export async function getMemberRole(userId: string, orgId: string): Promise<OrgRole | null> {
	const [row] = await db
		.select({ role: memberships.role })
		.from(memberships)
		.where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)));
	return row?.role ?? null;
}

export function roleAtLeast(role: OrgRole | null, minimum: OrgRole): boolean {
	return role !== null && ORG_ROLES.indexOf(role) >= ORG_ROLES.indexOf(minimum);
}

export async function addMember(orgId: string, userId: string, role: OrgRole): Promise<void> {
	await db
		.insert(memberships)
		.values({ orgId, userId, role })
		.onConflictDoUpdate({ target: [memberships.userId, memberships.orgId], set: { role } });
	await db
		.delete(membershipRequests)
		.where(and(eq(membershipRequests.orgId, orgId), eq(membershipRequests.userId, userId)));
}

export async function listMembers(orgId: string) {
	return db
		.select({ userId: users.id, email: users.email, name: users.name, role: memberships.role })
		.from(memberships)
		.innerJoin(users, eq(users.id, memberships.userId))
		.where(eq(memberships.orgId, orgId))
		.orderBy(asc(users.email));
}

export async function countOrganizationsByStatus(): Promise<Record<string, number>> {
	const rows = await db
		.select({ status: organizations.status, count: sql<number>`count(*)::int` })
		.from(organizations)
		.groupBy(organizations.status);
	return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}

/** Asks to join. Does nothing if the user is already a member or already asked. */
export async function requestMembership(orgId: string, userId: string): Promise<void> {
	if (await getMemberRole(userId, orgId)) return;
	await db.insert(membershipRequests).values({ orgId, userId }).onConflictDoNothing();
}

export async function listMembershipRequests(orgId: string) {
	return db
		.select({
			userId: users.id,
			email: users.email,
			name: users.name,
			createdAt: membershipRequests.createdAt
		})
		.from(membershipRequests)
		.innerJoin(users, eq(users.id, membershipRequests.userId))
		.where(eq(membershipRequests.orgId, orgId))
		.orderBy(asc(membershipRequests.createdAt));
}

/** Organizations the user is waiting to join. */
export async function listPendingOrganizationsForUser(userId: string): Promise<Organization[]> {
	const rows = await db
		.select({ org: organizations })
		.from(membershipRequests)
		.innerJoin(organizations, eq(organizations.id, membershipRequests.orgId))
		.where(eq(membershipRequests.userId, userId))
		.orderBy(asc(organizations.name));
	return rows.map((r) => r.org);
}

/** Lets a requester in (role given) or turns them away (role null). False if no such request. */
export async function answerMembershipRequest(
	orgId: string,
	userId: string,
	role: OrgRole | null
): Promise<boolean> {
	const removed = await db
		.delete(membershipRequests)
		.where(and(eq(membershipRequests.orgId, orgId), eq(membershipRequests.userId, userId)))
		.returning({ userId: membershipRequests.userId });
	if (removed.length === 0) return false;
	if (role) await addMember(orgId, userId, role);
	return true;
}
