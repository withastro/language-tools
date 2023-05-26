import * as kit from '@volar/kit';
import * as path from 'path';
import { getLanguageModule } from './core/index.js';
import { getSvelteLanguageModule } from './core/svelte.js';
import { getAstroInstall } from './core/utils.js';
import { getVueLanguageModule } from './core/vue.js';
import createAstroService from './plugins/astro.js';
import createTypeScriptService from './plugins/typescript/index.js';

const ts = require('typescript') as typeof import('typescript/lib/tsserverlibrary');
const tsconfig = getTsconfig();
const project = kit.createProject(tsconfig, [
	{ extension: 'astro', isMixedContent: true, scriptKind: 7 },
	{ extension: 'vue', isMixedContent: true, scriptKind: 7 },
	{ extension: 'svelte', isMixedContent: true, scriptKind: 7 },
]);
const config: kit.Config = {
	languages: {
		astro: getLanguageModule(getAstroInstall([process.cwd()]), ts),
		svelte: getSvelteLanguageModule(),
		vue: getVueLanguageModule(),
	},
	services: {
		typescript: createTypeScriptService(),
		astro: createAstroService(),
	},
};
const linter = kit.createLinter(config, project.languageServiceHost);

async function lintProject(fileNames: string[], ignoredFiles: string[], logErrors = false) {
	const files = fileNames.length > 0 ? fileNames : project.languageServiceHost.getScriptFileNames();

	const errors: kit.Diagnostic[] = [];
	for (const file of files) {
		const fileErrors = await linter.check(file);
		errors.push(...fileErrors);
		if (logErrors) {
			linter.logErrors(file, fileErrors);
		}
	}

	return errors;
}

lintProject([], [], true);

function getTsconfig() {
	let tsconfig = path.resolve(process.cwd(), './tsconfig.json');
	return tsconfig;
}
