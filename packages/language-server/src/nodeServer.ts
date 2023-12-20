import {
	createConnection,
	createNodeServer,
	createTypeScriptProjectProvider,
} from '@volar/language-server/node';
import { createPlugin } from './languageServerPlugin.js';

const connection = createConnection();
const server = createNodeServer(connection);

connection.listen();

connection.onInitialize((params) => {
	return server.initialize(
		params,
		createTypeScriptProjectProvider,
		createPlugin(connection, server.modules)
	);
});

connection.onInitialized(() => {
	server.initialized();
});
