import { createVirtualFiles } from '@volar/language-core';
import { decorateLanguageService, decorateLanguageServiceHost } from '@volar/typescript';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { getLanguageModule } from '@astrojs/language-server/dist/core';

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			const virtualFiles = createVirtualFiles([
				getLanguageModule(undefined, ts),
			]);

			decorateLanguageService(virtualFiles, info.languageService, true);
			decorateLanguageServiceHost(virtualFiles, info.languageServiceHost, ts, ['.astro']);

			return info.languageService;
		},
	};
	return pluginModule;
};

export = init;
