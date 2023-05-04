import type { Service } from '@volar/language-service';
import createTypeScriptService from 'volar-service-typescript';
import { AstroFile } from '../../core/index.js';
import { enhancedProvideCodeActions } from './codeActions.js';
import { enhancedProvideCompletionItems, enhancedResolveCompletionItem } from './completions.js';

export default (): Service =>
	(context, modules): ReturnType<Service> => {
		const typeScriptPlugin = createTypeScriptService()(context, modules);

		if (!context) {
			return { triggerCharacters: typeScriptPlugin.triggerCharacters };
		}

		return {
			...typeScriptPlugin,
			async provideCompletionItems(document, position, completionContext, token) {
				const originalCompletions = await typeScriptPlugin.provideCompletionItems!(
					document,
					position,
					completionContext,
					token
				);
				if (!originalCompletions) return null;

				return enhancedProvideCompletionItems(originalCompletions);
			},
			async resolveCompletionItem(item, token) {
				const resolvedCompletionItem = await typeScriptPlugin.resolveCompletionItem!(item, token);
				if (!resolvedCompletionItem) return item;

				return enhancedResolveCompletionItem(resolvedCompletionItem, item, context);
			},
			async provideCodeActions(document, range, codeActionContext, token) {
				const codeActions = await typeScriptPlugin.provideCodeActions!(
					document,
					range,
					codeActionContext,
					token
				);
				if (!codeActions) return null;

				const [_, source] = context.documents.getVirtualFileByUri(document.uri);
				const file = source?.root;
				if (!(file instanceof AstroFile) || !context.host) return codeActions;

				const newLine = context.host.getNewLine ? context.host.getNewLine() : '\n';

				// console.dir(codeActions, { depth: 100 });

				return enhancedProvideCodeActions(
					codeActions,
					file,
					context.documents.getDocumentByFileName(file.snapshot, file.sourceFileName),
					newLine
				);
			},
		};
	};
