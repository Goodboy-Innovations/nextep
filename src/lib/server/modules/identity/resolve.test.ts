import { describe, expect, it } from 'vitest';
import { decideExternalSignIn, parseAdminEmails } from './resolve';

describe('decideExternalSignIn', () => {
	const identity = { subject: 's', email: 'a@x.fi', name: null };
	const base = { identity, linkedUserId: null, currentUserId: null, emailTaken: false };

	it('an existing link signs in', () => {
		expect(decideExternalSignIn({ ...base, linkedUserId: 'u1', emailTaken: true })).toEqual({
			kind: 'existing',
			userId: 'u1'
		});
	});

	it('creates a user for an unused email', () => {
		expect(decideExternalSignIn(base)).toEqual({ kind: 'create', email: 'a@x.fi' });
	});

	it('never links to an existing user by email', () => {
		expect(decideExternalSignIn({ ...base, emailTaken: true })).toEqual({
			kind: 'reject',
			reason: 'email_in_use'
		});
	});

	it('requires an email for a new user', () => {
		expect(decideExternalSignIn({ ...base, identity: { ...identity, email: null } })).toEqual({
			kind: 'reject',
			reason: 'no_email'
		});
	});

	it('links to the signed-in user, whatever the email', () => {
		expect(decideExternalSignIn({ ...base, currentUserId: 'me', emailTaken: true })).toEqual({
			kind: 'link',
			userId: 'me'
		});
		expect(decideExternalSignIn({ ...base, currentUserId: 'me', linkedUserId: 'me' })).toEqual({
			kind: 'existing',
			userId: 'me'
		});
	});

	it('does not move an account linked to someone else', () => {
		expect(decideExternalSignIn({ ...base, currentUserId: 'me', linkedUserId: 'other' })).toEqual({
			kind: 'reject',
			reason: 'linked_elsewhere'
		});
	});
});

describe('parseAdminEmails', () => {
	it('lowercases and trims', () => {
		expect(parseAdminEmails(' A@x.fi , b@x.fi,')).toEqual(new Set(['a@x.fi', 'b@x.fi']));
	});
});
