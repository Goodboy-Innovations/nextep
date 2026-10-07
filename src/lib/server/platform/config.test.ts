import { describe, expect, it } from 'vitest';
import { checkConfig } from './config';

const base = {
	DATABASE_URL: 'postgres://nextep:secret@db.example:5432/nextep',
	ORIGIN: 'https://nextep.example'
};

describe('checkConfig', () => {
	it('summarises a complete configuration without secrets', () => {
		const summary = checkConfig({
			...base,
			ADMIN_EMAILS: 'a@example.com, b@example.com',
			SEED_ON_START: '1',
			SEED_ADMIN_EMAIL: 'admin@example.com',
			SEED_ADMIN_PASSWORD: 'seed-secret',
			FEEDBACK_CHAT_URL: 'https://feedback.example',
			FEEDBACK_SECRET: 'feedback-secret'
		});
		expect(summary).toBe(
			'database db.example/nextep · url https://nextep.example · admin emails 2 · seed on · feedback chat on'
		);
		expect(summary).not.toMatch(/secret/);
	});

	it('names every problem at once', () => {
		expect(() =>
			checkConfig({ FEEDBACK_CHAT_URL: 'https://f.example', SEED_ADMIN_EMAIL: 'a@example.com' })
		).toThrow(
			[
				'Configuration is incomplete:',
				'- DATABASE_URL is not set',
				'- ORIGIN is not set',
				'- SEED_ADMIN_EMAIL set without SEED_ADMIN_PASSWORD',
				'- FEEDBACK_CHAT_URL set without FEEDBACK_SECRET'
			].join('\n')
		);
	});

	it("rejects a preview's placeholder database", () => {
		expect(() => checkConfig({ ...base, DATABASE_URL: 'none' })).toThrow(
			'DATABASE_URL is not a postgres:// URL'
		);
	});

	it('refuses to seed without its own admin login', () => {
		expect(() => checkConfig({ ...base, SEED_ON_START: '1' })).toThrow(
			'SEED_ON_START set without SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD'
		);
		expect(checkConfig(base)).toContain('seed off');
	});

	it('needs both feedback chat variables', () => {
		expect(() => checkConfig({ ...base, FEEDBACK_SECRET: 's' })).toThrow(
			'FEEDBACK_SECRET set without FEEDBACK_CHAT_URL'
		);
		expect(checkConfig(base)).toContain('feedback chat off');
	});
});
