import {
	createConnection,
	createNodeServer,
	createSimpleProjectProvider,
} from '@volar/language-server/node';
import { createPlugin } from './languageServerPlugin.js';

const connection = createConnection();
const server = createNodeServer(connection);

connection.listen();

connection.onInitialize((params) => {
	return server.initialize(
		params,
		createSimpleProjectProvider,
		createPlugin(connection, server.modules)
	);
});

connection.onInitialized(() => {
	server.initialized();
});
