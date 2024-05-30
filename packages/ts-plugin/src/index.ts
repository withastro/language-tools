import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';
import { getLanguagePlugin } from './language.js';

export = createLanguageServicePlugin(() => [getLanguagePlugin()]);
