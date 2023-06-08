import { Service, TextDocumentEdit } from '@volar/language-server';
import createTypeScriptService from 'volar-service-typescript';
import { AstroFile } from '../../core/index.js';
import { ensureProperEditForFrontmatter } from '../../utils.js';
import { enhancedProvideCompletionItems, enhancedResolveCompletionItem } from './completions.js';
import { enhancedProvideSemanticDiagnostics } from './diagnostics.js';

export default (): Service =>
	(context, modules): ReturnType<Service> => {
		const typeScriptPlugin = createTypeScriptService()(context, modules);

		if (!context) {
			return {
				triggerCharacters: typeScriptPlugin.triggerCharacters,
				signatureHelpTriggerCharacters: typeScriptPlugin.signatureHelpTriggerCharacters,
				signatureHelpRetriggerCharacters: typeScriptPlugin.signatureHelpRetriggerCharacters,
			};
		}

		return {
			...typeScriptPlugin,
			transformCompletionItem(item) {
				const [_, source] = context.documents.getVirtualFileByUri(item.data.uri);
				const file = source?.root;
				if (!(file instanceof AstroFile) || !context.host) return undefined;
				if (file.scriptFiles.includes(item.data.fileName)) return undefined;

				const newLine = context.host.getCompilationSettings().newLine?.toString() ?? '\n';
				if (item.additionalTextEdits) {
					item.additionalTextEdits = item.additionalTextEdits.map((edit) => {
						// HACK: There's a weird situation sometimes where some components (especially Svelte) will get imported as type imports
						// for some unknown reason. This work around the problem by always ensuring a normal import for components
						if (item.data.isComponent && edit.newText.includes('import type')) {
							edit.newText.replace('import type', 'import');
						}

						return ensureProperEditForFrontmatter(edit, file.astroMeta.frontmatter, newLine);
					});
				}

				return item;
			},
			transformCodeAction(item) {
				if (item.kind !== 'quickfix') return item;
				const [_, source] = context.documents.getVirtualFileByUri(item.data.uri);
				const file = source?.root;
				if (!(file instanceof AstroFile) || !context.host) return item;
				if (
					file.scriptFiles.includes(item.diagnostics?.[0].data.documentUri.replace('file://', '')) // TODO: do this properly
				)
					return undefined;

				const newLine = context.host.getCompilationSettings().newLine?.toString() ?? '\n';
				if (item.edit && item.edit.documentChanges) {
					item.edit.documentChanges = item.edit.documentChanges.map((change) => {
						if (TextDocumentEdit.is(change)) {
							change.textDocument = {
								uri: item.data.uri.replace('.tsx', ''), // TODO: do this properly
								version: null,
							};
							change.edits = change.edits.map((edit) => {
								return ensureProperEditForFrontmatter(edit, file.astroMeta.frontmatter, newLine);
							});
						}
						return change;
					});
				}

				return item;
			},
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

				return enhancedResolveCompletionItem(resolvedCompletionItem);
			},
			async provideSemanticDiagnostics(document, token) {
				const [_, source] = context.documents.getVirtualFileByUri(document.uri);
				const file = source?.root;
				if (!(file instanceof AstroFile)) return null;

				// If we have compiler errors, our TSX isn't valid so don't bother showing TS errors
				if (file.hasCompilationErrors) return null;

				const diagnostics = await typeScriptPlugin.provideSemanticDiagnostics!(document, token);
				if (!diagnostics) return null;

				const astroDocument = context.documents.getDocumentByFileName(
					file.snapshot,
					file.sourceFileName
				);

				return enhancedProvideSemanticDiagnostics(diagnostics, astroDocument.lineCount);
			},
		};
	};
