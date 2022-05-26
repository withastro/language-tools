import {
	window,
	commands,
	workspace,
	ExtensionContext,
	TextDocument,
	Position,
	TextDocumentChangeEvent,
	ViewColumn,
} from 'vscode';
import {
	LanguageClient,
	RequestType,
	TextDocumentPositionParams,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';
import { LanguageClientOptions } from 'vscode-languageclient';
import { activateTagClosing } from './html/autoClose.js';
import { getCurrentServer, sleep } from './utils.js';

const TagCloseRequest: RequestType<TextDocumentPositionParams, string, any> = new RequestType('html/tag');

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
	const serverModule = require.resolve('@astrojs/language-server/bin/nodeServer.js');

	const port = 6040;
	const debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions,
		},
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'astro' }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('{**/*.js,**/*.ts}', false, false, false),
		},
		initializationOptions: {
			environment: 'node',
			dontFilterIncompleteCompletions: true, // VSCode filters client side and is smarter at it than us
			isTrusted: workspace.isTrusted,
		},
	};

	client = createLanguageServer(serverOptions, clientOptions);

	client
		.start()
		.then(() => {
			const tagRequestor = (document: TextDocument, position: Position) => {
				const param = client.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
				return client.sendRequest(TagCloseRequest, param);
			};
			const disposable = activateTagClosing(tagRequestor, { astro: true }, 'html.autoClosingTags');
			context.subscriptions.push(disposable);
		})
		.catch((err) => {
			console.error('Astro, unable to load language server.', err);
		});

	// Restart the language server if any critical files that are outside our jurisdiction got changed (tsconfig, jsconfig etc)
	workspace.onDidSaveTextDocument(async (doc: TextDocument) => {
		const fileName = doc.fileName.split(/\/|\\/).pop() ?? doc.fileName;
		if (
			[/^tsconfig\.json$/, /^jsconfig\.json$/, /^astro\.config\.(js|cjs|mjs|ts)$/].some((regex) => regex.test(fileName))
		) {
			await restartClient(false);
		}
	});

	workspace.onDidChangeTextDocument((params: TextDocumentChangeEvent) => {
		if (
			['vue', 'svelte', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(
				params.document.languageId
			)
		) {
			getLSClient().sendNotification('$/onDidChangeNonAstroFile', {
				uri: params.document.uri.toString(true),
				// We only support partial changes for JS/TS files
				changes: ['vue', 'svelte'].includes(params.document.languageId)
					? undefined
					: params.contentChanges.map((c) => ({
							range: {
								start: { line: c.range.start.line, character: c.range.start.character },
								end: { line: c.range.end.line, character: c.range.end.character },
							},
							text: c.text,
					  })),
			});
		}
	});

	context.subscriptions.push(
		commands.registerCommand('astro.restartLanguageServer', async () => {
			await restartClient(true);
		}),
		commands.registerCommand('astro.openDevServerPanel', async () => {
			// Let's first try to find if we have a dev server currently running already
			let url = await getDevServerUrl();

			// If not, let's run one
			if (!url) {
				const terminal = window.createTerminal({ name: 'astro:dev' });
				terminal.show();
				terminal.sendText('node ./node_modules/astro/astro.js dev');

				// Wait for the dev server to start
				await sleep(2500);

				url = await getDevServerUrl();

				if (!url) {
					window.showErrorMessage(
						'Could not find a local server. This might be because the dev server took too long to start'
					);
					return;
				}
			}

			commands.executeCommand('simpleBrowser.api.open', url, {
				viewColumn: ViewColumn.Beside,
			});

			/**
			 * Return a currently running dev server's URL
			 */
			async function getDevServerUrl() {
				const configuredPort = workspace.getConfiguration('astro.devServer').get<number>('port') ?? 3000;

				if (window.activeTextEditor) {
					const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor?.document.uri);

					if (workspaceFolder) {
						return await getCurrentServer(workspaceFolder, configuredPort);
					}
				} else if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
					return await getCurrentServer(workspace.workspaceFolders[0], configuredPort);
				} else {
					return await getCurrentServer(undefined, configuredPort);
				}
			}
		})
	);

	let restartingClient = false;
	async function restartClient(showNotification: boolean) {
		if (restartingClient) {
			return;
		}

		restartingClient = true;
		await client.stop();

		client = createLanguageServer(serverOptions, clientOptions);
		await client.start();

		if (showNotification) {
			window.showInformationMessage('Astro language server restarted.');
		}

		restartingClient = false;
	}

	function getLSClient() {
		return client;
	}

	return {
		getLanguageServer: getLSClient,
	};
}

export function deactivate(): Promise<void> | undefined {
	if (!client) {
		return undefined;
	}

	return client.stop();
}

function createLanguageServer(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
	return new LanguageClient('astro', 'Astro', serverOptions, clientOptions);
}
