import { describe, expect, it } from 'vitest';
import { googleIdentity } from './providers/google';
import { MICROSOFT_CONSUMER_TENANT, microsoftIdentity } from './providers/microsoft';
import { decideSignIn, parseAdminEmails } from './resolve';

const invited = { id: 'u1', isAdmin: false };
const none = new Set<string>();

describe('provider claims → identity', () => {
	it('trusts Google emails only when verified', () => {
		expect(googleIdentity({ sub: 'g1', email: 'A@x.fi', email_verified: true })).toMatchObject({
			email: 'a@x.fi',
			emailTrusted: true
		});
		expect(googleIdentity({ sub: 'g1', email: 'a@x.fi', email_verified: false }).emailTrusted).toBe(
			false
		);
	});

	it('trusts Microsoft emails for personal accounts', () => {
		const id = microsoftIdentity({
			sub: 'm1',
			tid: MICROSOFT_CONSUMER_TENANT,
			email: 'a@outlook.com'
		});
		expect(id.emailTrusted).toBe(true);
	});

	it('does not trust Microsoft work-tenant emails without xms_edov (nOAuth)', () => {
		const work = { sub: 'm1', tid: 'some-tenant', email: 'pastor@church.fi' };
		expect(microsoftIdentity(work).emailTrusted).toBe(false);
		expect(microsoftIdentity({ ...work, xms_edov: true }).emailTrusted).toBe(true);
		expect(microsoftIdentity({ ...work, xms_edov: '1' as never }).emailTrusted).toBe(false);
	});
});

describe('decideSignIn', () => {
	const trusted = { subject: 's', email: 'a@x.fi', emailTrusted: true, name: null };

	it('an existing link wins over email', () => {
		expect(
			decideSignIn({
				identity: { ...trusted, email: 'other@x.fi' },
				linkedUser: invited,
				userWithEmail: { id: 'u2', isAdmin: false },
				adminEmails: none
			})
		).toEqual({ kind: 'existing', userId: 'u1', promoteToAdmin: false });
	});

	it('links an invited user by trusted email', () => {
		expect(
			decideSignIn({
				identity: trusted,
				linkedUser: null,
				userWithEmail: invited,
				adminEmails: none
			})
		).toEqual({ kind: 'link', userId: 'u1', promoteToAdmin: false });
	});

	it('never links by an untrusted email', () => {
		expect(
			decideSignIn({
				identity: { ...trusted, emailTrusted: false },
				linkedUser: null,
				userWithEmail: invited,
				adminEmails: parseAdminEmails('a@x.fi')
			})
		).toEqual({ kind: 'reject', reason: 'email_unverified' });
	});

	it('rejects people who were not invited', () => {
		expect(
			decideSignIn({ identity: trusted, linkedUser: null, userWithEmail: null, adminEmails: none })
		).toEqual({ kind: 'reject', reason: 'not_invited' });
	});

	it('bootstraps admins from ADMIN_EMAILS', () => {
		const admins = parseAdminEmails(' A@x.fi , b@x.fi');
		expect(
			decideSignIn({
				identity: trusted,
				linkedUser: null,
				userWithEmail: null,
				adminEmails: admins
			})
		).toEqual({ kind: 'create-admin', email: 'a@x.fi' });
		expect(
			decideSignIn({
				identity: trusted,
				linkedUser: null,
				userWithEmail: invited,
				adminEmails: admins
			})
		).toEqual({ kind: 'link', userId: 'u1', promoteToAdmin: true });
	});
});
