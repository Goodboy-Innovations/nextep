export { MIN_PASSWORD_LENGTH } from './password';
export {
	SESSION_COOKIE,
	authenticate,
	createSession,
	createUser,
	findUserByEmail,
	hasPassword,
	invalidateSession,
	listLinkedAccounts,
	listUsers,
	setAdmin,
	setPassword,
	signInWithExternalAccount,
	validateSession,
	type SessionUser,
	type SignInResult
} from './service';
export type { SignInRejection } from './resolve';
export type { ExternalIdentity } from './types';
