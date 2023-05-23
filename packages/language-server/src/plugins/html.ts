import type { Service } from '@volar/language-server';
import createHtmlService from 'volar-service-html';
import { AstroFile } from '../core/index.js';
import { isInComponentStartTag } from '../utils.js';
import { astroAttributes, astroElements, classListAttribute } from './html-data.js';

export default (): Service =>
	(context, modules): ReturnType<Service> => {
		const htmlPlugin = createHtmlService()(context, modules);

		if (!context) {
			return { triggerCharacters: htmlPlugin.triggerCharacters };
		}

		htmlPlugin.provide['html/updateCustomData']?.([
			astroAttributes,
			astroElements,
			classListAttribute,
		]);

		return {
			...htmlPlugin,
			provideCompletionItems(document, position, completionContext, token) {
				if (document.languageId !== 'html') return;

				const [_, source] = context.documents.getVirtualFileByUri(document.uri);
				const rootVirtualFile = source?.root;
				if (!(rootVirtualFile instanceof AstroFile)) return;

				// Don't return completions if the current node is a component
				if (isInComponentStartTag(rootVirtualFile.htmlDocument, document.offsetAt(position))) {
					return null;
				}

				return htmlPlugin.provideCompletionItems!(document, position, completionContext, token);
			},
		};
	};
