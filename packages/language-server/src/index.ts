import {
	LanguageServerPlugin,
	createConnection,
	startLanguageServer,
} from '@volar/language-server/node';
import createCssService from 'volar-service-css';
import createEmmetService from 'volar-service-emmet';
import createPrettierService from 'volar-service-prettier';
import createTypeScriptService from 'volar-service-typescript';
import createTypeScriptTwoSlashService from 'volar-service-typescript-twoslash-queries';
import { getLanguageModule } from './core';
import { getSvelteLanguageModule } from './core/svelte.js';
import { getAstroInstall } from './core/utils';
import { getVueLanguageModule } from './core/vue.js';
import { getPrettierPluginPath, importPrettier } from './importPackage.js';
import createAstroPlugin from './plugins/astro.js';
import createHtmlPlugin from './plugins/html.js';

const plugin: LanguageServerPlugin = (initOptions, modules): ReturnType<LanguageServerPlugin> => ({
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
				getAstroInstall([ctx.project.rootUri.fsPath]),
				modules.typescript!
			);
			config.languages.vue = getVueLanguageModule();
			config.languages.svelte = getSvelteLanguageModule();
		}

		config.services ??= {};
		config.services.html ??= createHtmlPlugin();
		config.services.css ??= createCssService();
		config.services.emmet ??= createEmmetService();
		config.services.typescript ??= createTypeScriptService();
		config.services.typescripttwoslash ??= createTypeScriptTwoSlashService();
		config.services.astro ??= createAstroPlugin();
		config.services.prettier ??= createPrettierService({
			languages: ['astro'],
			additionalOptions: (resolvedConfig) => {
				function getAstroPrettierPlugin() {
					if (!ctx?.project.rootUri) return [];

					const rootDir = ctx.env.uriToFileName(ctx?.project.rootUri.toString());
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
