import { dirname, resolve } from 'path';
import type * as svelte from '@astrojs/svelte/dist/editor.cjs';
import type * as vue from '@astrojs/svelte/dist/editor.cjs';

let isTrusted = true;

export function setIsTrusted(_isTrusted: boolean) {
	isTrusted = _isTrusted;
}

export function getPackagePath(packageName: string, fromPath: string): string | undefined {
	const paths = [];
	if (isTrusted) {
		paths.unshift(fromPath);
	}

	try {
		const packageJSONPath = require.resolve(`${packageName}/package.json`, {
			paths,
		});

		return dirname(packageJSONPath);
	} catch (e) {
		return undefined;
	}
}

function importEditorIntegration<T>(packageName: string, fromPath: string): T | undefined {
	const pkgPath = getPackagePath(packageName, fromPath);

	if (pkgPath) {
		const main = resolve(pkgPath, 'dist', 'editor.cjs');

		return require(main) as T;
	}

	return undefined;
}

export function importSvelteIntegration(fromPath: string): typeof svelte | undefined {
	return importEditorIntegration('@astrojs/svelte', fromPath);
}

export function importVueIntegration(fromPath: string): typeof vue | undefined {
	return importEditorIntegration('@astrojs/vue', fromPath);
}
