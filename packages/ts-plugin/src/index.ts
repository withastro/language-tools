import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';
import type { CollectionConfig } from './frontmatter.js';
import { getFrontmatterLanguagePlugin } from './frontmatter.js';
import { getLanguagePlugin } from './language.js';
import type { LanguagePlugin } from '@volar/language-core';

export = createLanguageServicePlugin((ts, info) => {
	let collectionConfig = undefined;

	try {
		collectionConfig = {
			folder: info.project.getCurrentDirectory(),
			config: JSON.parse(
				ts.sys.readFile(
					info.project.getCurrentDirectory() + '/.astro/collections/collections.json',
				) as string,
			) as CollectionConfig['config'],
		};
	} catch (err) {
		// If the file doesn't exist, we don't really care, but if it's something else, we want to know
		if (err && (err as any).code !== 'ENOENT') console.error(err);
	}

	let languagePlugins: LanguagePlugin<string>[] = [getLanguagePlugin()];

	if (collectionConfig) {
		languagePlugins.push(getFrontmatterLanguagePlugin([collectionConfig]));
	}

	return {
		languagePlugins,
	};
});
