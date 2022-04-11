import { ExtensionContext, Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient/browser';
import { getInitOptions } from './shared';

export async function activate(context: ExtensionContext) {
	const serverMain = Uri.joinPath(context.extensionUri, 'dist/browser/server.js');
	const worker = new Worker(serverMain.toString());

	const clientOptions = getInitOptions('browser');
	const client = createLanguageServer(clientOptions, worker);
	context.subscriptions.push(client.start());

	function getLSClient() {
		return client;
	}

	return {
		getLanguageServer: getLSClient,
	};
}

function createLanguageServer(clientOptions: LanguageClientOptions, worker: Worker) {
	return new LanguageClient('astro', 'Astro', clientOptions, worker);
}
