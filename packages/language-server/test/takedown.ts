import { getLanguageServer } from './server.js';

export default async function teardown() {
	const languageServer = await getLanguageServer();
	languageServer.handle.connection.dispose();
}
