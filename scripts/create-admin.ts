// Creates a platform admin with a password, or makes an existing user one and gives them a new
// password: `npm run create-admin -- admin@example.fi "Name"`. For a fresh installation; after
// that, admins manage users under Ylläpito. Prints the password once.

import { randomBytes } from 'node:crypto';
import { sql } from '../src/lib/server/platform';
import {
	createUser,
	findUserByEmail,
	setAdmin,
	setPassword
} from '../src/lib/server/modules/identity';

async function main() {
	const [email, name] = process.argv.slice(2);
	if (!email?.includes('@')) {
		console.error('Usage: npm run create-admin -- <email> ["Name"]');
		process.exitCode = 1;
		return;
	}
	const password = randomBytes(12).toString('base64url');
	const existing = await findUserByEmail(email);
	if (existing) {
		await setPassword(existing.id, password);
		await setAdmin(existing.id, true);
		console.log(`${existing.email} is now a platform admin with a new password.`);
	} else {
		const user = await createUser({ email, name: name || email, password, isAdmin: true });
		console.log(`Created platform admin ${user.email}.`);
	}
	console.log(`Password: ${password}`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => sql.end());
