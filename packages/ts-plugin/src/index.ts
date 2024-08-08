import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';
import type { CollectionConfig} from './frontmatter.js';
import { getFrontmatterLanguagePlugin } from './frontmatter.js';
import { getLanguagePlugin } from './language.js';

export = createLanguageServicePlugin((ts, info) => {
	const collectionConfigs = {
		folder: info.project.getCurrentDirectory(),
		config: JSON.parse(
			ts.sys.readFile(
				info.project.getCurrentDirectory() + '/.astro/collections/collections.json',
			) as string,
		) as CollectionConfig['config'],
	};

	return {
		languagePlugins: [getLanguagePlugin(), getFrontmatterLanguagePlugin([collectionConfigs])],
	};
});
