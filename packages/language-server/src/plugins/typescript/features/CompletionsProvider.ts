import {
	CompletionContext,
	CompletionItem,
	Position,
	TextDocumentIdentifier,
	MarkupContent,
	CompletionTriggerKind,
	TextEdit,
	Range,
	CancellationToken,
} from 'vscode-languageserver';
import type { LanguageServiceManager } from '../LanguageServiceManager';
import { getWordRangeAt, isInsideExpression, isInsideFrontmatter } from '../../../core/documents/utils';
import { AstroDocument, mapRangeToOriginal } from '../../../core/documents';
import ts from 'typescript';
import { CompletionList, MarkupKind } from 'vscode-languageserver';
import { AppCompletionItem, AppCompletionList, CompletionsProvider } from '../../interfaces';
import {
	scriptElementKindToCompletionItemKind,
	getCommitCharactersForScriptElement,
	toVirtualAstroFilePath,
	removeAstroComponentSuffix,
	convertRange,
	ensureFrontmatterInsert,
} from '../utils';
import { AstroSnapshotFragment, SnapshotFragment } from '../snapshots/DocumentSnapshot';
import { getRegExpMatches, isNotNullOrUndefined } from '../../../utils';
import { flatten } from 'lodash';

const completionOptions: ts.GetCompletionsAtPositionOptions = {
	importModuleSpecifierPreference: 'relative',
	importModuleSpecifierEnding: 'auto',
	quotePreference: 'single',
	includeCompletionsForModuleExports: true,
	includeCompletionsForImportStatements: true,
	allowIncompleteCompletions: true,
	includeCompletionsWithInsertText: true,
};

export interface CompletionEntryWithIdentifer extends ts.CompletionEntry, TextDocumentIdentifier {
	position: Position;
}

/**
 * The language service throws an error if the character is not a valid trigger character.
 * Also, the completions are worse.
 * Therefore, only use the characters the typescript compiler treats as valid.
 */
type validTriggerCharacter = '.' | '"' | "'" | '`' | '/' | '@' | '<' | '#';

// `import {...} from '..'` or `import ... from '..'`
// Note: Does not take into account if import is within a comment.
const scriptImportRegex = /\bimport\s+{([^}]*?)}\s+?from\s+['"`].+?['"`]|\bimport\s+(\w+?)\s+from\s+['"`].+?['"`]/g;

export class CompletionsProviderImpl implements CompletionsProvider<CompletionEntryWithIdentifer> {
	constructor(private languageServiceManager: LanguageServiceManager) {}

	private readonly validTriggerCharacters = ['.', '"', "'", '`', '/', '@', '<', '#'] as const;

	private isValidTriggerCharacter(character: string | undefined): character is validTriggerCharacter {
		return this.validTriggerCharacters.includes(character as validTriggerCharacter);
	}

	async getCompletions(
		document: AstroDocument,
		position: Position,
		completionContext?: CompletionContext,
		cancellationToken?: CancellationToken
	): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null> {
		// TODO: Add support for script tags
		const html = document.html;
		const offset = document.offsetAt(position);
		const node = html.findNodeAt(offset);
		if (node.tag === 'script') {
			return null;
		}

		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
		const filePath = toVirtualAstroFilePath(tsDoc.filePath);

		const triggerCharacter = completionContext?.triggerCharacter;
		const triggerKind = completionContext?.triggerKind;

		const validTriggerCharacter = this.isValidTriggerCharacter(triggerCharacter) ? triggerCharacter : undefined;
		const isCustomTriggerCharacter = triggerKind === CompletionTriggerKind.TriggerCharacter;

		if ((isCustomTriggerCharacter && !validTriggerCharacter) || cancellationToken?.isCancellationRequested) {
			return null;
		}

		const fragment = await tsDoc.createFragment();
		const isCompletionInsideFrontmatter = isInsideFrontmatter(document.getText(), offset);

		// When at the root of the document TypeScript offer all kinds of completions, because it doesn't know yet that
		// it's JSX and not JS. Not only do we don't care about those completions, this result in a pretty big performance hit.
		// As such, people who are using Emmet to write their template suffer from a very degraded experience from what
		// they're used to in HTML files (which is instant completions). So let's disable ourselves when we're at the root
		if (!isCompletionInsideFrontmatter && !node.parent && !isInsideExpression(document.getText(), node.start, offset)) {
			return null;
		}

		const wordRange = getWordRangeAt(document.getText(), offset, {
			left: /[^\s.]+$/,
			right: /[^\w$:]/,
		});
		const wordRangeStartPosition = document.positionAt(wordRange.start);

		const existingImports = this.getExistingImports(document);
		const entries =
			lang.getCompletionsAtPosition(filePath, offset, { ...completionOptions, triggerCharacter: validTriggerCharacter })
				?.entries || [];

		if (entries.length === 0) {
			return null;
		}

		const completionItems = entries
			.map((entry: ts.CompletionEntry) =>
				this.toCompletionItem(fragment, entry, document.uri, position, isCompletionInsideFrontmatter, existingImports)
			)
			.filter(isNotNullOrUndefined)
			.map((entry) => this.fixTextEditRange(wordRangeStartPosition, entry));

		return CompletionList.create(completionItems, true);
	}

	async resolveCompletion(
		document: AstroDocument,
		completionItem: AppCompletionItem<CompletionEntryWithIdentifer>,
		cancellationToken?: CancellationToken
	): Promise<AppCompletionItem<CompletionEntryWithIdentifer>> {
		const { data: comp } = completionItem;
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);

		let filePath = toVirtualAstroFilePath(tsDoc.filePath);

		if (!comp || !filePath || cancellationToken?.isCancellationRequested) {
			return completionItem;
		}

		const fragment = await tsDoc.createFragment();
		const detail = lang.getCompletionEntryDetails(
			filePath, // fileName
			fragment.offsetAt(comp.position), // position
			comp.name, // entryName
			{}, // formatOptions
			comp.source, // source
			completionOptions, // preferences
			comp.data // data
		);

		if (detail) {
			const { detail: itemDetail, documentation: itemDocumentation } = this.getCompletionDocument(detail);

			completionItem.detail = itemDetail;
			completionItem.documentation = itemDocumentation;
		}

		const actions = detail?.codeActions;

		if (actions) {
			const edit: TextEdit[] = [];

			for (const action of actions) {
				for (const change of action.changes) {
					edit.push(
						...change.textChanges.map((textChange) =>
							this.codeActionChangeToTextEdit(document, fragment as AstroSnapshotFragment, textChange)
						)
					);
				}
			}

			completionItem.additionalTextEdits = (completionItem.additionalTextEdits ?? []).concat(edit);
		}

		return completionItem;
	}

	private toCompletionItem(
		fragment: SnapshotFragment,
		comp: ts.CompletionEntry,
		uri: string,
		position: Position,
		insideFrontmatter: boolean,
		existingImports: Set<string>
	): AppCompletionItem<CompletionEntryWithIdentifer> | null {
		const completionLabelAndInsert = this.getCompletionLabelAndInsert(comp);
		if (!completionLabelAndInsert) {
			return null;
		}

		const { label, insertText, isAstroComponent, replacementSpan } = completionLabelAndInsert;

		const isImport = insertText?.includes('import');

		if (isAstroComponent && !isImport && insideFrontmatter) {
			return null;
		}

		// TS may suggest another component even if there already exists an import with the same.
		// This happens because internally, components get suffixed with __AstroComponent_
		if (isAstroComponent && existingImports.has(label)) {
			return null;
		}

		const textEdit = replacementSpan
			? TextEdit.replace(convertRange(fragment, replacementSpan), insertText ?? label)
			: undefined;

		return {
			label,
			insertText,
			kind: scriptElementKindToCompletionItemKind(comp.kind),
			commitCharacters: getCommitCharactersForScriptElement(comp.kind),
			sortText: comp.sortText,
			preselect: comp.isRecommended,
			textEdit,
			// pass essential data for resolving completion
			data: {
				...comp,
				uri,
				position,
			},
		};
	}

	private getCompletionLabelAndInsert(comp: ts.CompletionEntry) {
		let { name, insertText } = comp;
		const isAstroComponent = this.isAstroComponentImport(name);

		if (isAstroComponent) {
			name = removeAstroComponentSuffix(name);
		}

		if (comp.replacementSpan) {
			return {
				label: name,
				isAstroComponent,
				insertText: insertText ? removeAstroComponentSuffix(insertText) : undefined,
				replacementSpan: comp.replacementSpan,
			};
		}

		return {
			label: name,
			isAstroComponent,
		};
	}

	private fixTextEditRange(wordRangePosition: Position, completionItem: CompletionItem) {
		const { textEdit } = completionItem;
		if (!textEdit || !TextEdit.is(textEdit)) {
			return completionItem;
		}

		const {
			newText,
			range: { start },
		} = textEdit;

		const wordRangeStartCharacter = wordRangePosition.character;
		if (wordRangePosition.line !== wordRangePosition.line || start.character > wordRangePosition.character) {
			return completionItem;
		}

		textEdit.newText = newText.substring(wordRangeStartCharacter - start.character);
		textEdit.range.start = {
			line: start.line,
			character: wordRangeStartCharacter,
		};

		completionItem.additionalTextEdits = [
			TextEdit.replace(
				{
					start,
					end: {
						line: start.line,
						character: wordRangeStartCharacter,
					},
				},
				newText.substring(0, wordRangeStartCharacter - start.character)
			),
		];

		return completionItem;
	}

	codeActionChangeToTextEdit(document: AstroDocument, fragment: AstroSnapshotFragment, change: ts.TextChange) {
		change.newText = removeAstroComponentSuffix(change.newText);

		// If we don't have a frontmatter already, create one with the import
		const frontmatterState = document.astroMeta.frontmatter.state;
		if (frontmatterState === null) {
			return TextEdit.replace(
				Range.create(Position.create(0, 0), Position.create(0, 0)),
				`---${ts.sys.newLine}${change.newText}---${ts.sys.newLine}${ts.sys.newLine}`
			);
		}

		const { span } = change;
		let range: Range;
		const virtualRange = convertRange(fragment, span);

		range = mapRangeToOriginal(fragment, virtualRange);
		range = ensureFrontmatterInsert(range, document);

		return TextEdit.replace(range, change.newText);
	}

	private getCompletionDocument(compDetail: ts.CompletionEntryDetails) {
		const { sourceDisplay, documentation: tsDocumentation, displayParts } = compDetail;
		let detail: string = removeAstroComponentSuffix(ts.displayPartsToString(displayParts));

		if (sourceDisplay) {
			const importPath = ts.displayPartsToString(sourceDisplay);
			detail = `Auto import from ${importPath}\n${detail}`;
		}

		const documentation: MarkupContent | undefined = tsDocumentation
			? { value: tsDocumentation.join('\n'), kind: MarkupKind.Markdown }
			: undefined;

		return {
			documentation,
			detail,
		};
	}

	private getExistingImports(document: AstroDocument) {
		const rawImports = getRegExpMatches(scriptImportRegex, document.getText()).map((match) =>
			(match[1] ?? match[2]).split(',')
		);
		const tidiedImports = flatten(rawImports).map((match) => match.trim());
		return new Set(tidiedImports);
	}

	private isAstroComponentImport(className: string) {
		return className.endsWith('__AstroComponent_');
	}
}
