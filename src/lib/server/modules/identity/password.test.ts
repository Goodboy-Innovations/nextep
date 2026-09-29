import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
	it('verifies the right password and rejects others', async () => {
		const hash = await hashPassword('oikea-salasana');
		expect(hash.startsWith('scrypt$')).toBe(true);
		expect(await verifyPassword('oikea-salasana', hash)).toBe(true);
		expect(await verifyPassword('väärä-salasana', hash)).toBe(false);
	});

	it('salts every hash', async () => {
		expect(await hashPassword('sama')).not.toBe(await hashPassword('sama'));
	});

	it('rejects malformed stored values', async () => {
		expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
	});
});
