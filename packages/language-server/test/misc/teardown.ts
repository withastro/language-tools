import { describe, it } from 'node:test';
import teardown from '../takedown.js';

describe('Teardown', () => {
	// This file is just to make sure the teardown file is included in the test run until we can upgrade to a newer Node.js version.
	// The actual teardown logic is in `takedown.ts`.

	it('Can teardown', async () => {
		await teardown();
	});
});
