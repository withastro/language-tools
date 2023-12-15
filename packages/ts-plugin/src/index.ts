import { createTSServerPlugin } from '@volar/typescript/lib/starters/createTSServerPlugin.js';
import { getLanguageModule } from './language.js';

export = createTSServerPlugin((ts) => {
	return {
		extensions: ['.astro'],
		languagePlugins: [getLanguageModule(ts)],
	};
});
