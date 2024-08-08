import {
	createConnection,
	createServer,
	createTypeScriptProject,
	loadTsdkByPath,
} from '@volar/language-server/node';
import { URI, Utils } from 'vscode-uri';
import type { CollectionConfig } from './core/frontmatterHolders.js';
import { getLanguagePlugins, getLanguageServicePlugins } from './languageServerPlugin.js';

const connection = createConnection();
const server = createServer(connection);

let contentIntellisenseEnabled = false;

connection.listen();

connection.onInitialize((params) => {
	const tsdk = params.initializationOptions?.typescript?.tsdk;

	contentIntellisenseEnabled = params.initializationOptions?.contentIntellisense ?? false;

	if (!tsdk) {
		throw new Error(
			'The `typescript.tsdk` init option is required. It should point to a directory containing a `typescript.js` or `tsserverlibrary.js` file, such as `node_modules/typescript/lib`.',
		);
	}

	const { typescript, diagnosticMessages } = loadTsdkByPath(tsdk, params.locale);

	const collectionConfigs = contentIntellisenseEnabled
		? (params.workspaceFolders ?? []).flatMap((folder) => {
				const folderUri = URI.parse(folder.uri);
				const collections = JSON.parse(
					server.fs.readFile(
						Utils.joinPath(folderUri, '.astro/collections/collections.json'),
					) as string,
				) as CollectionConfig['config'];

				return { folder: folderUri, config: collections };
			})
		: [];

	return server.initialize(
		params,
		createTypeScriptProject(typescript, diagnosticMessages, ({ env, configFileName }) => {
			return {
				languagePlugins: getLanguagePlugins(
					connection,
					typescript,
					env,
					configFileName,
					collectionConfigs,
				),
				setup() {},
			};
		}),
		getLanguageServicePlugins(connection, typescript, collectionConfigs),
		{ pullModelDiagnostics: params.initializationOptions?.pullModelDiagnostics },
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
		extensions.push('md', 'mdx', 'mdoc');
	}

	server.watchFiles([`**/*.{${extensions.join(',')}}`]);
});
