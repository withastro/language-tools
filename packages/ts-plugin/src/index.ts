import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';
import { getLanguagePlugin } from './language.js';
import { CollectionConfig, getFrontmatterLanguagePlugin } from './frontmatter.js';

export = createLanguageServicePlugin((ts, info) => {
	const collectionConfigs = {
		folder: info.project.getCurrentDirectory(),
		config: JSON.parse(
			ts.sys.readFile(
				info.project.getCurrentDirectory() + '/.astro/collections/collections.json'
			) as string
		) as CollectionConfig['config'],
	};

	return {
		languagePlugins: [getLanguagePlugin(), getFrontmatterLanguagePlugin([collectionConfigs])],
	};
});
