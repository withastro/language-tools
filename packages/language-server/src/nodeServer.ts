import {
	type WorkspaceFolder,
	createConnection,
	createServer,
	createSimpleProject,
	loadTsdkByPath,
} from '@volar/language-server/node';
import { URI, Utils } from 'vscode-uri';
import {
	type CollectionConfig,
	type CollectionConfigInstance,
	SUPPORTED_FRONTMATTER_EXTENSIONS_KEYS,
} from './core/frontmatterHolders.js';
import { getLanguagePlugins, getLanguageServicePlugins } from './languageServerPlugin.js';

const connection = createConnection();
const server = createServer(connection);

let contentIntellisenseEnabled = false;

connection.listen();

connection.onInitialize((params) => {
	const tsdk = params.initializationOptions?.typescript?.tsdk;

	if (!tsdk) {
		throw new Error(
			'The `typescript.tsdk` init option is required. It should point to a directory containing a `typescript.js` or `tsserverlibrary.js` file, such as `node_modules/typescript/lib`.',
		);
	}

	const { typescript, diagnosticMessages } = loadTsdkByPath(tsdk, params.locale);

	contentIntellisenseEnabled = params.initializationOptions?.contentIntellisense ?? false;
	const collectionConfig = {
		reload(folders) {
			this.configs = loadCollectionConfig(folders);
		},
		configs: contentIntellisenseEnabled
			? loadCollectionConfig(
					// The vast majority of clients support workspaceFolders, but sometimes some unusual environments like tests don't
					params.workspaceFolders ?? (params.rootUri ? [{ uri: params.rootUri }] : []) ?? [],
				)
			: [],
	} satisfies CollectionConfig;

	function loadCollectionConfig(folders: WorkspaceFolder[] | { uri: string }[]) {
		return folders.flatMap((folder) => {
			try {
				const folderUri = URI.parse(folder.uri);
				let config = server.fileSystem.readFile(
					Utils.joinPath(folderUri, '.astro/collections/collections.json'),
				);

				if (!config) {
					return [];
				}

				// `server.fs.readFile` can theoretically be async, but in practice it's always sync
				const collections = JSON.parse(config as string) as CollectionConfigInstance;

				return { folder: folderUri, config: collections };
			} catch (err) {
				// If the file doesn't exist, we don't really care, but if it's something else, we want to know
				if (err && (err as any).code !== 'ENOENT') console.error(err);
				return [];
			}
		});
	}

	return server.initialize(
		params,
		createSimpleProject(getLanguagePlugins(collectionConfig)),
		getLanguageServicePlugins(connection, typescript, collectionConfig),
	);
});

connection.onInitialized(() => {
	server.initialized();

	const extensions = [
		'js',
		'cjs',
		'mjs',
		'ts',
		'cts',
		'mts',
		'jsx',
		'tsx',
		'json',
		'astro',
		'vue',
		'svelte',
	];

	if (contentIntellisenseEnabled) {
		extensions.push(...SUPPORTED_FRONTMATTER_EXTENSIONS_KEYS);
		server.fileWatcher.watchFiles(['**/*.schema.json', '**/collections.json']);
		server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
			const shouldReload = changes.some(
				(change) => change.uri.endsWith('.schema.json') || change.uri.endsWith('collections.json'),
			);

			if (shouldReload) {
				server.project.reload();
			}
		});
	}

	server.fileWatcher.watchFiles([`**/*.{${extensions.join(',')}}`]);
});
