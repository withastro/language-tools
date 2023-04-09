import { DiagnosticModel, LanguageServerInitializationOptions } from '@volar/language-server';
import { activateAutoInsertion, activateShowVirtualFiles } from '@volar/vscode';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';

let client: lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'dist/node/server.js');
	const runOptions = { execArgv: <string[]>[] };
	const debugOptions = { execArgv: ['--nolazy', '--inspect=' + 6009] };
	const serverOptions: lsp.ServerOptions = {
		run: {
			module: serverModule.fsPath,
			transport: lsp.TransportKind.ipc,
			options: runOptions,
		},
		debug: {
			module: serverModule.fsPath,
			transport: lsp.TransportKind.ipc,
			options: debugOptions,
		},
	};
	const initializationOptions: LanguageServerInitializationOptions = {
		// no need tsdk because language server do not have typescript features
		typescript: { tsdk: require('path').join(vscode.env.appRoot, 'extensions/node_modules/typescript/lib') },
		diagnosticModel: DiagnosticModel.Pull,
	};
	const clientOptions: lsp.LanguageClientOptions = {
		documentSelector: [{ language: 'astro' }],
		initializationOptions,
	};
	client = new lsp.LanguageClient('astro-language-server', 'Astro Language Server', serverOptions, clientOptions);
	await client.start();

	// support for auto close tag
	activateAutoInsertion([client], (document) => document.languageId === 'astro');
	activateShowVirtualFiles('astro.showTSXOutput', client);
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
