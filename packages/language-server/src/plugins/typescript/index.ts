import { ServicePlugin, ServicePluginInstance, TextDocumentEdit } from '@volar/language-server';
import { create as createTypeScriptService } from 'volar-service-typescript';
import { AstroVirtualCode } from '../../core/index.js';
import {
	editShouldBeInFrontmatter,
	ensureProperEditForFrontmatter,
	ensureRangeIsInFrontmatter,
} from '../utils.js';
import { enhancedProvideCompletionItems, enhancedResolveCompletionItem } from './completions.js';
import { enhancedProvideSemanticDiagnostics } from './diagnostics.js';

export const create = (ts: typeof import('typescript')): ServicePlugin => {
	const tsServicePlugin = createTypeScriptService(ts as typeof import('typescript'));
	return {
		...tsServicePlugin,
		create(context): ServicePluginInstance {
			const tsService = tsServicePlugin.create(context);
			return {
				...tsService,
				transformCompletionItem(item) {
					const [virtualCode, source] = context.documents.getVirtualCodeByUri(item.data.uri);
					const code = source?.generated?.code;
					if (!(code instanceof AstroVirtualCode) || !context.language.typescript) return undefined;
					if (virtualCode && code.scriptCodeIds.includes(virtualCode.id)) return undefined;

					const newLine =
						context.language.typescript.languageServiceHost
							.getCompilationSettings()
							.newLine?.toString() ?? '\n';
					if (item.additionalTextEdits) {
						item.additionalTextEdits = item.additionalTextEdits.map((edit) => {
							// HACK: There's a weird situation sometimes where some components (especially Svelte) will get imported as type imports
							// for some unknown reason. This work around the problem by always ensuring a normal import for components
							if (item.data.isComponent && edit.newText.includes('import type')) {
								edit.newText.replace('import type', 'import');
							}

							if (editShouldBeInFrontmatter(edit.range)) {
								return ensureProperEditForFrontmatter(edit, code.astroMeta.frontmatter, newLine);
							}

							return edit;
						});
					}

					return item;
				},
				transformCodeAction(item) {
					if (item.kind !== 'quickfix') return undefined;

					const [virtualCode, source] = context.documents.getVirtualCodeByUri(item.data.uri);
					if (!source) return undefined;

					const code = source?.generated?.code;
					if (!(code instanceof AstroVirtualCode) || !context.language.typescript) return undefined;
					if (virtualCode && code.scriptCodeIds.includes(virtualCode.id)) return undefined;

					const document = context.documents.get(
						context.documents.getVirtualCodeUri(source.id, code.id),
						code.languageId,
						code.snapshot
					);
					const newLine =
						context.language.typescript.languageServiceHost
							.getCompilationSettings()
							.newLine?.toString() ?? '\n';
					if (!item.edit?.documentChanges) return undefined;
					item.edit.documentChanges = item.edit.documentChanges.map((change) => {
						if (TextDocumentEdit.is(change)) {
							change.textDocument.uri = source.id;
							if (change.edits.length === 1) {
								change.edits = change.edits.map((edit) => {
									const editInFrontmatter = editShouldBeInFrontmatter(edit.range, document);
									if (editInFrontmatter.itShould) {
										return ensureProperEditForFrontmatter(
											edit,
											code.astroMeta.frontmatter,
											newLine,
											editInFrontmatter.position
										);
									}

									return edit;
								});
							} else {
								if (code.astroMeta.frontmatter.status === 'closed') {
									change.edits = change.edits.map((edit) => {
										const editInFrontmatter = editShouldBeInFrontmatter(edit.range, document);
										if (editInFrontmatter.itShould) {
											edit.range = ensureRangeIsInFrontmatter(
												edit.range,
												code.astroMeta.frontmatter,
												editInFrontmatter.position
											);
										}
										return edit;
									});
								} else {
									// TODO: Handle when there's multiple edits and a new frontmatter is potentially needed
									if (
										change.edits.some((edit) => {
											return editShouldBeInFrontmatter(edit.range, document).itShould;
										})
									) {
										console.error(
											'Code actions with multiple edits that require potentially creating a frontmatter are currently not implemented. In the meantime, please manually insert a frontmatter in your file before using this code action.'
										);
										change.edits = [];
									}
								}
							}
						}
						return change;
					});

					return item;
				},
				async provideCompletionItems(document, position, completionContext, token) {
					const originalCompletions = await tsService.provideCompletionItems!(
						document,
						position,
						completionContext,
						token
					);
					if (!originalCompletions) return null;

					return enhancedProvideCompletionItems(originalCompletions);
				},
				async resolveCompletionItem(item, token) {
					const resolvedCompletionItem = await tsService.resolveCompletionItem!(item, token);
					if (!resolvedCompletionItem) return item;

					return enhancedResolveCompletionItem(resolvedCompletionItem);
				},
				async provideSemanticDiagnostics(document, token) {
					const [_, source] = context.documents.getVirtualCodeByUri(document.uri);
					const code = source?.generated?.code;
					let astroDocument = undefined;

					if (source && code instanceof AstroVirtualCode) {
						// If we have compiler errors, our TSX isn't valid so don't bother showing TS errors
						if (code.hasCompilationErrors) return null;

						astroDocument = context.documents.get(
							context.documents.getVirtualCodeUri(source.id, code.id),
							code.languageId,
							code.snapshot
						);
					}

					const diagnostics = await tsService.provideSemanticDiagnostics!(document, token);
					if (!diagnostics) return null;

					return enhancedProvideSemanticDiagnostics(diagnostics, astroDocument?.lineCount);
				},
			};
		},
	};
};
