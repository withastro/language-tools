import createCssPlugin from '@volar-plugins/css';
import createEmmetPlugin from '@volar-plugins/emmet';
import createHtmlPlugin from '@volar-plugins/html';
import createPrettierPlugin from '@volar-plugins/prettier';
import createTypeScriptPlugin from '@volar-plugins/typescript';
import createTypeScriptTwoSlash from '@volar-plugins/typescript-twoslash-queries';
import {
	LanguageServerPlugin,
	LanguageServicePluginInstance,
	createConnection,
	startLanguageServer,
} from '@volar/language-server/node';
import { AstroFile, getLanguageModule } from './core';
import { getAstroInstall } from './core/utils';
import { getPrettierPluginPath, importPrettier } from './importPackage.js';
import createAstroPlugin from './plugins/astro.js';
import { isInComponentStartTag } from './utils.js';

const plugin: LanguageServerPlugin = (): ReturnType<LanguageServerPlugin> => ({
	extraFileExtensions: [{ extension: 'astro', isMixedContent: true, scriptKind: 7 }],
	watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', 'astro'],
	resolveConfig(config, modules, ctx) {
		config.languages ??= {};
		if (ctx) {
			config.languages.astro = getLanguageModule(
				getAstroInstall([ctx.project.rootUri.fsPath])!,
				modules.typescript!
			);
		}

		config.plugins ??= {};

		const originalHtmlPlugin = config.plugins?.html ?? createHtmlPlugin();
		config.plugins.html ??= (context): LanguageServicePluginInstance => {
			const base =
				typeof originalHtmlPlugin === 'function' ? originalHtmlPlugin(context) : originalHtmlPlugin;

			return {
				...base,
				provideCompletionItems(document, position, completionContext, token) {
					const [file] = context!.documents.getVirtualFileByUri(document.uri);
					if (!(file instanceof AstroFile)) return;

					// Don't return completions if the current node is a component
					if (isInComponentStartTag(file.htmlDocument, document.offsetAt(position))) {
						return null;
					}

					return base.provideCompletionItems!(document, position, completionContext, token);
				},
			};
		};
		config.plugins.css ??= createCssPlugin();
		config.plugins.emmet ??= createEmmetPlugin();
		config.plugins.typescript ??= createTypeScriptPlugin();
		config.plugins.typescripttwoslash ??= createTypeScriptTwoSlash();
		config.plugins.astro ??= createAstroPlugin();
		config.plugins.prettier ??= createPrettierPlugin({
			languages: ['astro'],
			additionalOptions: (resolvedConfig) => {
				function getAstroPrettierPlugin() {
					if (!ctx?.project.rootUri) return [];

					const rootDir = ctx?.options.uriToFileName(ctx?.project.rootUri.toString());
					const prettier = importPrettier(rootDir);
					const hasPluginLoadedAlready = prettier
						.getSupportInfo()
						.languages.some((l: any) => l.name === 'astro');
					return hasPluginLoadedAlready ? [] : [getPrettierPluginPath(rootDir)];
				}

				return {
					plugins: [...getAstroPrettierPlugin(), ...(resolvedConfig.plugins ?? [])],
					parser: 'astro',
				};
			},
		});

		return config;
	},
});

startLanguageServer(createConnection(), plugin);
