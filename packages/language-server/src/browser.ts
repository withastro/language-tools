import { createConnection, BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageserver/browser';
import { startLanguageServer } from './server';
import ts from 'typescript/lib/tsserverlibrary';

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

startLanguageServer(connection, {
	loadTypescript(options) {
		return ts; // not support load by user config in web
	},
	loadTypescriptLocalized(options) {
		// TODO
	},
});
