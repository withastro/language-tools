import * as vscode from 'vscode-languageserver';
import { TextDocumentIdentifier } from 'vscode-languageserver';
import { ConfigManager } from './core/config/ConfigManager';
import { DocumentManager } from './core/documents/DocumentManager';
import { AstroPlugin } from './plugins/astro/AstroPlugin';
import { CSSPlugin } from './plugins/css/CSSPlugin';
import { HTMLPlugin } from './plugins/html/HTMLPlugin';
import { AppCompletionItem } from './plugins/interfaces';
import { PluginHost } from './plugins/PluginHost';
import { TypeScriptPlugin } from './plugins/typescript/TypeScriptPlugin';

const TagCloseRequest: vscode.RequestType<vscode.TextDocumentPositionParams, string | null, any> =
	new vscode.RequestType('html/tag');

// Start the language server
export function startLanguageServer(connection: vscode.Connection) {
	// Create our managers
	const configManager = new ConfigManager();
	const documentManager = new DocumentManager();
	const pluginHost = new PluginHost(documentManager);

	connection.onInitialize((params: vscode.InitializeParams) => {
		// Register plugins
		pluginHost.registerPlugin(new HTMLPlugin(configManager));
		pluginHost.registerPlugin(new CSSPlugin(configManager));

		// We don't currently support running the TypeScript and Astro plugin in the browser
		if (params.initializationOptions.environment !== 'browser') {
			pluginHost.registerPlugin(new AstroPlugin(configManager));
			pluginHost.registerPlugin(new TypeScriptPlugin(configManager));
		}

		// Update language-server config with what the user supplied to us at launch
		configManager.updateConfig(params.initializationOptions.configuration.astro);
		configManager.updateEmmetConfig(params.initializationOptions.configuration.emmet);

		return {
			capabilities: {
				textDocumentSync: vscode.TextDocumentSyncKind.Incremental,
				completionProvider: {
					resolveProvider: true,
				},
				colorProvider: true,
			},
		};
	});

	// On update of the user configuration of the language-server
	connection.onDidChangeConfiguration(({ settings }) => {
		configManager.updateConfig(settings.astro);
		configManager.updateEmmetConfig(settings.emmet);
	});

	// Documents
	connection.onDidOpenTextDocument((evt) => {
		documentManager.openDocument(evt.textDocument);
		documentManager.markAsOpenedInClient(evt.textDocument.uri);
	});

	connection.onDidCloseTextDocument((evt) => documentManager.closeDocument(evt.textDocument.uri));
	connection.onDidChangeTextDocument((evt) => {
		documentManager.updateDocument(evt.textDocument, evt.contentChanges);
	});

	// Features
	connection.onHover((evt: vscode.HoverParams) => pluginHost.doHover(evt.textDocument, evt.position));
	connection.onCompletion((evt, cancellationToken) => {
		return pluginHost.getCompletions(evt.textDocument, evt.position, evt.context, cancellationToken);
	});

	connection.onCompletionResolve((completionItem) => {
		const data = (completionItem as AppCompletionItem).data as TextDocumentIdentifier;

		if (!data) {
			return completionItem;
		}
		return pluginHost.resolveCompletion(data, completionItem);
	});

	connection.onDocumentColor((evt) => pluginHost.getDocumentColors(evt.textDocument));
	connection.onColorPresentation((evt) => pluginHost.getColorPresentations(evt.textDocument, evt.range, evt.color));
	connection.onRequest(TagCloseRequest, (evt: any) => pluginHost.doTagComplete(evt.textDocument, evt.position));

	// Taking off 🚀
	connection.onInitialized(() => {
		connection.console.log('Successfully initialized! 🚀');
	});

	connection.listen();
}
