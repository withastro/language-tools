/* eslint-disable no-console */
import { LanguageServerHandle, startLanguageServer } from '@volar/test-utils';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as protocol from 'vscode-languageserver-protocol/node';
import { URI } from 'vscode-uri';

let serverHandle: LanguageServerHandle | undefined;
let initializeResult: protocol.InitializeResult | undefined;

export async function getLanguageServer() {
	if (!serverHandle) {
		serverHandle = startLanguageServer(
			path.resolve('./bin/nodeServer.js'),
			fileURLToPath(new URL('./fixture', import.meta.url))
		);

		initializeResult = await serverHandle.initialize(
			URI.file(fileURLToPath(new URL('./fixture', import.meta.url))).toString(),
			{
				typescript: {
					tsdk: path.join(
						path.dirname(fileURLToPath(import.meta.url)),
						'../',
						'node_modules',
						'typescript',
						'lib'
					),
				},
			}
		);
		// Ensure that our first test does not suffer from a TypeScript overhead
		await serverHandle.sendCompletionRequest(
			'file://doesnt-exists',
			protocol.Position.create(0, 0)
		);
	}

	if (!initializeResult || !serverHandle) {
		throw new Error('Server not initialized');
	}

	return {
		serverHandle: serverHandle,
		initializeResult: initializeResult,
		connection: serverHandle.connection,
	};
}
