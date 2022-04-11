import { ExtensionContext, Uri } from 'vscode';
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { LanguageClientOptions } from 'vscode-languageclient';
import { getInitOptions } from './shared';

export async function activate(context: ExtensionContext) {
	const serverModule = Uri.joinPath(context.extensionUri, 'dist/node/server.js');

	const port = 6040;
	const debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };

	const serverOptions: ServerOptions = {
		run: { module: serverModule.fsPath, transport: TransportKind.ipc },
		debug: {
			module: serverModule.fsPath,
			transport: TransportKind.ipc,
			options: debugOptions,
		},
	};

	const clientOptions = getInitOptions('node');
	let client = createLanguageServer(serverOptions, clientOptions);
	context.subscriptions.push(client.start());

	function getLSClient() {
		return client;
	}

	return {
		getLanguageServer: getLSClient,
	};
}

function createLanguageServer(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
	return new LanguageClient('astro', 'Astro', serverOptions, clientOptions);
}
