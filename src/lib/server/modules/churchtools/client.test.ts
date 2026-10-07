import { describe, expect, it } from 'vitest';
import {
	churchProfile,
	churchToolsIdentity,
	churchToolsProvider,
	classifyClientCheck,
	instanceSubdomain,
	normalizeInstanceHost,
	providerHost
} from './client';

describe('ChurchTools instance host', () => {
	it('accepts a subdomain, a host or a URL', () => {
		for (const input of [
			'utopia',
			' Utopia ',
			'utopia.church.tools',
			'https://utopia.church.tools/x'
		]) {
			expect(normalizeInstanceHost(input)).toBe('utopia.church.tools');
		}
		expect(instanceSubdomain('utopia.church.tools')).toBe('utopia');
	});

	it('rejects anything that is not a church.tools subdomain', () => {
		for (const input of [
			'',
			'   ',
			'utopia church',
			'http://',
			'127.0.0.1',
			'a_b',
			'-utopia',
			'ct.seurakunta.fi',
			'evil.com/utopia.church.tools',
			'a.b.church.tools'
		]) {
			expect(normalizeInstanceHost(input)).toBeNull();
		}
	});
});

describe('ChurchTools client pre-flight check', () => {
	const instance = { status: 200, contentType: 'application/json; charset=utf-8' };

	it('passes a known client with the right secret', () => {
		// A made-up code fails after the client is authenticated.
		expect(classifyClientCheck(instance, 200, 'invalid_request')).toBe('ok');
		expect(classifyClientCheck(instance, 302, 'invalid_grant')).toBe('ok');
	});

	it('sends to setup when ChurchTools does not know the client or its redirect URI', () => {
		expect(classifyClientCheck(instance, 404, null)).toBe('client_missing');
		expect(classifyClientCheck(instance, 401, null)).toBe('client_missing');
	});

	it('catches a wrong client secret', () => {
		expect(classifyClientCheck(instance, 200, 'invalid_client')).toBe('secret_wrong');
	});

	it('catches a subdomain without an instance (church.tools redirects those)', () => {
		expect(classifyClientCheck({ status: 302, contentType: 'text/html' }, 302, null)).toBe(
			'no_instance'
		);
	});

	it('lets the person through when ChurchTools cannot be reached', () => {
		expect(classifyClientCheck(null, null, null)).toBe('ok');
		expect(classifyClientCheck(instance, 503, null)).toBe('ok');
	});

	it('does not send people to setup when ChurchTools is busy', () => {
		expect(classifyClientCheck(instance, 429, null)).toBe('ok');
		expect(classifyClientCheck(instance, 408, null)).toBe('ok');
	});

	it('judges a stored client by its authorization page alone', () => {
		expect(classifyClientCheck(null, 404, null)).toBe('client_missing');
		expect(classifyClientCheck(null, 200, null)).toBe('ok');
	});
});

describe('ChurchTools userinfo → identity', () => {
	it('maps the person id, email and name', () => {
		expect(
			churchToolsIdentity({
				id: 42,
				email: 'Jane@X.fi',
				data: { firstName: 'Jane', lastName: 'Doe', displayName: 'Jane D.' }
			})
		).toEqual({ subject: '42', email: 'jane@x.fi', name: 'Jane D.' });
	});

	it('falls back to first + last name and handles a missing email', () => {
		expect(
			churchToolsIdentity({ id: 7, email: '', data: { firstName: 'Jane', lastName: 'Doe' } })
		).toEqual({ subject: '7', email: null, name: 'Jane Doe' });
	});

	it('requires a person id', () => {
		expect(() => churchToolsIdentity({ id: '' })).toThrow();
	});
});

describe('ChurchTools /api/info → church profile', () => {
	it('maps name and address, coordinates only as a pair', () => {
		expect(
			churchProfile({
				siteName: ' Esimerkkiseurakunta ',
				address: {
					street: 'Mannerheimintie 5',
					zip: '00100',
					city: 'Helsinki',
					latitude: '60.1695749',
					longitude: '24.939536'
				}
			})
		).toEqual({
			name: 'Esimerkkiseurakunta',
			streetAddress: 'Mannerheimintie 5',
			postalCode: '00100',
			city: 'Helsinki',
			lat: 60.1695749,
			lng: 24.939536
		});
		expect(churchProfile({ address: { latitude: '60.1', longitude: null } })).toMatchObject({
			name: null,
			lat: null,
			lng: null
		});
	});
});

describe('provider ids', () => {
	it('round-trips the host and ignores other providers', () => {
		expect(providerHost(churchToolsProvider('utopia.church.tools'))).toBe('utopia.church.tools');
		expect(providerHost('google')).toBeNull();
	});
});
