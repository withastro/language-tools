import createCssPlugin from '@volar-plugins/css';
import createEmmetPlugin from '@volar-plugins/emmet';
import createHtmlPlugin from '@volar-plugins/html';
import createTypeScriptPlugin from '@volar-plugins/typescript';
import {
	LanguageServerPlugin,
	createConnection,
	startLanguageServer,
} from '@volar/language-server/node';
import { getLanguageModule } from './core';
import { startWASMService } from './core/parseAstro';
import { getAstroInstall } from './core/utils';

startWASMService().then(() => {
	const plugin: LanguageServerPlugin = (): ReturnType<LanguageServerPlugin> => ({
		extraFileExtensions: [{ extension: 'astro', isMixedContent: true, scriptKind: 7 }],
		watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', 'astro'],
		resolveConfig(config, modules, ctx) {
			config.languages ??= {};
			if (ctx) {
				config.languages.astro = getLanguageModule(getAstroInstall([ctx.project.rootUri.fsPath])!);
			}

			config.plugins ??= {};
			config.plugins.html ??= createHtmlPlugin();
			config.plugins.css ??= createCssPlugin();
			config.plugins.emmet ??= createEmmetPlugin();
			config.plugins.typescript ??= createTypeScriptPlugin();

			return config;
		},
	});

	startLanguageServer(createConnection(), plugin);
});
