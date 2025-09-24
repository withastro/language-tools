import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as protocol from '@volar/language-server/protocol';
import type { LabsInfo } from '@volar/vscode';
import {
	activateAutoInsertion,
	activateFindFileReferences,
	activateReloadProjects,
	activateTsConfigStatusItem,
	activateTsVersionStatusItem,
	createLabsInfo,
	getTsdk,
} from '@volar/vscode';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';

let client: lsp.BaseLanguageClient;
let collectionsWatcher: vscode.FileSystemWatcher;

type InitOptions = {
	typescript: {
		tsdk: string;
	};
} & Record<string, unknown>;

export async function activate(context: vscode.ExtensionContext): Promise<LabsInfo> {
	const runtimeConfig = vscode.workspace.getConfiguration('astro.language-server');

	const { workspaceFolders } = vscode.workspace;
	const rootPath = workspaceFolders?.[0].uri.fsPath;

	let lsPath = await getConfiguredServerPath(context.workspaceState);
	if (typeof lsPath === 'string' && lsPath.trim() !== '' && typeof rootPath === 'string') {
		lsPath = path.isAbsolute(lsPath) ? lsPath : path.join(rootPath, lsPath);
		console.info(`Using language server at ${lsPath}`);
	} else {
		lsPath = undefined;
	}
	const serverModule = lsPath
		? require.resolve(lsPath)
		: vscode.Uri.joinPath(context.extensionUri, 'dist/node/server.js').fsPath;

	const runOptions = { execArgv: [] };
	const debugOptions = {
		execArgv: ['--nolazy', '--inspect=' + Math.floor(Math.random() * 20000 + 10000)],
	};

	const serverOptions: lsp.ServerOptions = {
		run: {
			module: serverModule,
			transport: lsp.TransportKind.ipc,
			options: runOptions,
		},
		debug: {
			module: serverModule,
			transport: lsp.TransportKind.ipc,
			options: debugOptions,
		},
	};

	const serverRuntime = runtimeConfig.get<string>('runtime');
	if (serverRuntime) {
		serverOptions.run.runtime = serverRuntime;
		serverOptions.debug.runtime = serverRuntime;
		console.info(`Using ${serverRuntime} as runtime`);
	}

	const hasContentIntellisense = vscode.workspace
		.getConfiguration('astro')
		.get('content-intellisense');
	const initializationOptions = {
		typescript: {
			tsdk: (await getTsdk(context))!.tsdk,
		},
		contentIntellisense: hasContentIntellisense,
	} satisfies InitOptions;

	if (hasContentIntellisense && rootPath) {
		await initializeCollectionSchemaAutoconfig(rootPath);
	}

	const clientOptions = {
		documentSelector: [
			{ language: 'astro' },
			...(hasContentIntellisense
				? [{ language: 'markdown' }, { language: 'mdx' }, { language: 'markdoc' }]
				: []),
		],
		initializationOptions,
	} satisfies lsp.LanguageClientOptions;
	client = new lsp.LanguageClient('astro', 'Astro Language Server', serverOptions, clientOptions);
	await client.start();

	// support for auto close tag
	activateAutoInsertion('astro', client);
	activateFindFileReferences('astro.findFileReferences', client);
	activateReloadProjects('astro.reloadProjects', client);
	activateTsConfigStatusItem('astro', 'astro.openTsConfig', client);
	activateTsVersionStatusItem('astro', 'astro.selectTypescriptVersion', context, (text) => text);

	const volarLabs = createLabsInfo(protocol);
	volarLabs.addLanguageClient(client);

	return volarLabs.extensionExports;
}

export async function deactivate() {
	return Promise.allSettled([client?.stop(), collectionsWatcher?.dispose()]);
}

async function getConfiguredServerPath(workspaceState: vscode.Memento) {
	const scope = 'astro.language-server';
	const detailedLSPath = vscode.workspace.getConfiguration(scope).inspect<string>('ls-path');

	const lsPath =
		detailedLSPath?.globalLanguageValue ||
		detailedLSPath?.defaultLanguageValue ||
		detailedLSPath?.globalValue ||
		detailedLSPath?.defaultValue;

	const workspaceLSPath =
		detailedLSPath?.workspaceFolderLanguageValue ||
		detailedLSPath?.workspaceLanguageValue ||
		detailedLSPath?.workspaceFolderValue ||
		detailedLSPath?.workspaceValue;

	const useLocalLanguageServerKey = `${scope}.useLocalLS`;
	let useWorkspaceServer = workspaceState.get<boolean>(useLocalLanguageServerKey);

	if (useWorkspaceServer === undefined && workspaceLSPath !== undefined) {
		const msg =
			'This workspace contains an Astro Language Server version. Would you like to use the workplace version?';
		const allowPrompt = 'Allow';
		const dismissPrompt = 'Dismiss';
		const neverPrompt = 'Never in This Workspace';

		const result = await vscode.window.showInformationMessage(
			msg,
			allowPrompt,
			dismissPrompt,
			neverPrompt,
		);

		if (result === allowPrompt) {
			await workspaceState.update(useLocalLanguageServerKey, true);
			useWorkspaceServer = true;
		} else if (result === neverPrompt) {
			await workspaceState.update(useLocalLanguageServerKey, false);
		}
	}

	if (useWorkspaceServer === true) {
		return workspaceLSPath || lsPath;
	} else {
		return lsPath;
	}
}

/**
 * Factory that creates an updater function to run when collection metadata changes.
 * @param rootPath The root path of the user’s Astro project.
 */
const createSchemaConfigUpdater = (rootPath: string) => async (uri: vscode.Uri) => {
	try {
		// Read the Astro-generated collections metadata.
		const collectionsMetaBytes = await vscode.workspace.fs.readFile(uri);
		const collectionsMetaString = new TextDecoder().decode(collectionsMetaBytes);
		const collectionsMeta = JSON.parse(collectionsMetaString) as {
			collections: Array<{ hasSchema: boolean; name: string }>;
			entries: Record<string, string>;
		};

		const configScope = 'json.schemas';
		/** The current `json.schemas` configuration in this workspace. */
		const jsonConfig =
			vscode.workspace.getConfiguration().inspect<any[]>(configScope)?.workspaceValue || [];
		/** User-authored entries from the `json.schemas` array. */
		const userEntriesJSON = jsonConfig.filter((item) => !('__astro__' in item));

		/** Entries for `json.schemas` based on collection metadata. */
		const autoGenEntriesJSON = collectionsMeta.collections
			.map(({ name }) => ({
				fileMatch: Object.entries(collectionsMeta.entries)
					.filter(([file, collection]) => collection === name && file.endsWith('.json'))
					.map(([file]) => fileURLToPath(file).replace(rootPath.toLowerCase(), '')),
				url: `./.astro/collections/${name}.schema.json`,
				__astro__: true,
			}))
			// Skip entries with no file matches.
			.filter(({ fileMatch }) => fileMatch.length > 0);

		// Update `json.schemas` in workspace settings, adding auto-generated values.
		await vscode.workspace
			.getConfiguration()
			.update(configScope, [...userEntriesJSON, ...autoGenEntriesJSON]);

		const yamlSchemasConfigScope = 'yaml.schemas';
		/** The current `yaml.schemas` configuration in this workspace. */
		const yamlConfig =
			vscode.workspace
				.getConfiguration()
				.inspect<Record<string, string | string[]>>(yamlSchemasConfigScope)?.workspaceValue || {};
		/** User-authored entries from the `yaml.schemas` object. */
		const userEntriesYAML = Object.entries(yamlConfig).filter(
			([, val]) => typeof val === 'string' || val.at(-1) !== '__astro__',
		);

		/** Entries for `yaml.schemas` based on collection metadata. */
		const autoGenEntriesYAML = collectionsMeta.collections
			.map(
				({ name }) =>
					[
						`./.astro/collections/${name}.schema.json`,
						Object.entries(collectionsMeta.entries)
							.filter(
								([file, collection]) =>
									collection === name && (file.endsWith('.yml') || file.endsWith('.yaml')),
							)
							.map(([file]) => fileURLToPath(file).replace(rootPath.toLowerCase(), '')),
					] as const,
			)
			.filter(([, files]) => files.length > 0)
			.map(([schema, files]) => [schema, [...files, '__astro__']] as const);

		// Update `yaml.schemas` in workspace settings, adding auto-generated values.
		await vscode.workspace
			.getConfiguration()
			.update(
				yamlSchemasConfigScope,
				Object.fromEntries([...userEntriesYAML, ...autoGenEntriesYAML]),
			);
	} catch (error) {
		console.error(error);
	}
};

/**
 * Watch for changes to the `.astro/collections/collections.json` metadata and mirror it to the
 * VS Code workspace configuration for JSON and YAML schemas.
 * @param rootPath The root path of the user’s Astro project.
 */
async function initializeCollectionSchemaAutoconfig(rootPath: string) {
	const updateSchemaConfig = createSchemaConfigUpdater(rootPath);

	const collectionsPath = '.astro/collections/collections.json';
	collectionsWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(rootPath, collectionsPath),
	);
	collectionsWatcher.onDidChange(updateSchemaConfig);
	collectionsWatcher.onDidCreate(updateSchemaConfig);
	collectionsWatcher.onDidDelete(updateSchemaConfig);

	await updateSchemaConfig(vscode.Uri.file(`${rootPath}/${collectionsPath}`));
}
