import createCssPlugin from '@volar-plugins/css';
import createEmmetPlugin from '@volar-plugins/emmet';
import createPrettierPlugin from '@volar-plugins/prettier';
import createTypeScriptPlugin from '@volar-plugins/typescript';
import createTypeScriptTwoSlash from '@volar-plugins/typescript-twoslash-queries';
import {
	LanguageServerPlugin,
	createConnection,
	startLanguageServer,
} from '@volar/language-server/node';
import { getLanguageModule } from './core';
import { getSvelteLanguageModule } from './core/svelte.js';
import { getAstroInstall } from './core/utils';
import { getVueLanguageModule } from './core/vue.js';
import { getPrettierPluginPath, importPrettier } from './importPackage.js';
import createAstroPlugin from './plugins/astro.js';
import createHtmlPlugin from './plugins/html.js';

const plugin: LanguageServerPlugin = (): ReturnType<LanguageServerPlugin> => ({
	extraFileExtensions: [
		{ extension: 'astro', isMixedContent: true, scriptKind: 7 },
		{ extension: 'vue', isMixedContent: true, scriptKind: 7 },
		{ extension: 'svelte', isMixedContent: true, scriptKind: 7 },
	],
	watchFileExtensions: [
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
	],
	resolveConfig(config, ctx) {
		config.languages ??= {};
		if (ctx) {
			config.languages.astro = getLanguageModule(
				getAstroInstall([ctx.project.rootUri.fsPath])!,
				ctx.project.workspace.workspaces.ts!
			);
			config.languages.vue = getVueLanguageModule();
			config.languages.svelte = getSvelteLanguageModule();
		}

		config.plugins ??= {};
		config.plugins.html ??= createHtmlPlugin();
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
