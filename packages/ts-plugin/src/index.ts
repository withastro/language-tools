import type { LanguagePlugin } from '@volar/language-core';
import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';
import type { CollectionConfig } from './frontmatter.js';
import { getFrontmatterLanguagePlugin } from './frontmatter.js';
import { getLanguagePlugin } from './language.js';

function getCollectionConfig(
	readFile: (path: string) => string | undefined,
): CollectionConfig['config'] | undefined {
	try {
		let fileContent = readFile('/.astro/astro/collections/collections.json');
		if (fileContent) {
			return JSON.parse(fileContent);
		}
		fileContent = readFile('/.astro/collections/collections.json');
		if (fileContent) {
			return JSON.parse(fileContent);
		}
	} catch (err) {
		// If the file doesn't exist, we don't really care, but if it's something else, we want to know
		if (err && (err as any).code !== 'ENOENT') console.error(err);
	}
}

export = createLanguageServicePlugin((ts, info) => {
	const currentDir = info.project.getCurrentDirectory();

	const collectionConfig = getCollectionConfig((path) => ts.sys.readFile(currentDir + path));

	let languagePlugins: LanguagePlugin<string>[] = [getLanguagePlugin()];

	if (collectionConfig) {
		languagePlugins.push(
			getFrontmatterLanguagePlugin([
				{
					folder: currentDir,
					config: collectionConfig,
				},
			]),
		);
	}

	return {
		languagePlugins,
	};
});
