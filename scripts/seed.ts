// Demo data for local development. Run with `npm run db:seed` (add `-- --reset` to wipe first).
// The data itself is in src/lib/server/seed/demo.ts.

import { sql } from '../src/lib/server/platform';
import { seedDemo } from '../src/lib/server/seed/demo';

seedDemo({ reset: process.argv.includes('--reset') })
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => sql.end());
