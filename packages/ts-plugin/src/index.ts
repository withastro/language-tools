import { createVirtualFiles } from '@volar/language-core';
import { decorateLanguageService, decorateLanguageServiceHost } from '@volar/typescript';
import type ts from 'typescript/lib/tsserverlibrary';
import { getLanguageModule } from './language.js';

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const pluginModule: ts.server.PluginModule = {
		create(info) {
			const virtualFiles = createVirtualFiles([getLanguageModule(ts)]);

			decorateLanguageService(virtualFiles, info.languageService, true);
			decorateLanguageServiceHost(virtualFiles, info.languageServiceHost, ts, ['.astro']);

			return info.languageService;
		},
	};
	return pluginModule;
};

export = init;
