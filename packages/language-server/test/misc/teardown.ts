import { describe, it } from 'node:test';
import { getLanguageServer } from '../server.js';

describe('Teardown', () => {
	// This file is just to make sure the teardown file is included in the test run until we can upgrade to a newer Node.js version.
	// The actual teardown logic is in `takedown.ts`.

	it('Can teardown', async () => {
		const languageServer = await getLanguageServer();
		languageServer.handle.connection.dispose();
		languageServer.handle.process.kill();
	});
});
