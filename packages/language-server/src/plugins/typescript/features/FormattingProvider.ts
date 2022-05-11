import ts, { FormatCodeSettings } from 'typescript';
import { FormattingOptions, Position, TextEdit, Range } from 'vscode-languageserver-types';
import { ConfigManager } from '../../../core/config';
import { AstroDocument } from '../../../core/documents';
import { FormattingProvider } from '../../interfaces';
import { LanguageServiceManager } from '../LanguageServiceManager';
import { AstroSnapshot } from '../snapshots/DocumentSnapshot';
import { convertRange, getScriptTagSnapshot, toVirtualAstroFilePath } from '../utils';

export class FormattingProviderImpl implements FormattingProvider {
	constructor(private languageServiceManager: LanguageServiceManager, private configManager: ConfigManager) {}

	async formatDocument(document: AstroDocument, options: FormattingOptions): Promise<TextEdit[]> {
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
		const filePath = toVirtualAstroFilePath(tsDoc.filePath);

		const formatConfig = await this.configManager.getTSFormatConfig(document, options);

		let frontmatterEdits: ts.TextChange[] = [];
		let scriptTagsEdits: ts.TextChange[] = [];

		if (document.astroMeta.frontmatter.state === 'closed') {
			const start = document.astroMeta.frontmatter.startOffset!;
			const end = document.astroMeta.frontmatter.endOffset!;
			frontmatterEdits = lang.getFormattingEditsForRange(filePath, start, end, formatConfig);
		}

		document.scriptTags.forEach((scriptTag) => {
			const { filePath: scriptFilePath, snapshot: scriptTagSnapshot } = getScriptTagSnapshot(
				tsDoc as AstroSnapshot,
				document,
				scriptTag.container
			);

			const startLine = document.offsetAt(Position.create(scriptTag.startPos.line, 0));
			const initialIndentLevel = computeInitialIndent(document, startLine, options);
			const baseIndent = (formatConfig.tabSize ?? 0) * (initialIndentLevel + 1);

			const formatSettings: FormatCodeSettings = {
				baseIndentSize: baseIndent,
				indentStyle: ts.IndentStyle.Smart,
				...formatConfig,
			};

			let edits = lang.getFormattingEditsForDocument(scriptFilePath, formatSettings);

			if (edits) {
				edits = edits
					.map((edit) => {
						edit.span.start = document.offsetAt(
							scriptTagSnapshot.getOriginalPosition(scriptTagSnapshot.positionAt(edit.span.start))
						);

						return edit;
					})
					.filter((edit) => {
						return (
							scriptTagSnapshot.isInGenerated(document.positionAt(edit.span.start)) &&
							scriptTag.end !== edit.span.start &&
							// Don't format the last line of the file as it's in most case the indentation
							scriptTag.endPos.line !== document.positionAt(edit.span.start).line
						);
					});

				const endLine = document.getLineUntilOffset(document.offsetAt(scriptTag.endPos));

				if (isWhitespaceOnly(endLine)) {
					const endLineStartOffset = document.offsetAt(Position.create(scriptTag.endPos.line, 0));
					const lastLineIndentRange = Range.create(Position.create(scriptTag.endPos.line, 0), scriptTag.endPos);

					edits.push({
						span: {
							start: endLineStartOffset,
							length: lastLineIndentRange.end.character,
						},
						newText: generateIndent(initialIndentLevel, options),
					});
				}
			}

			scriptTagsEdits.push(...edits);
		});

		return [...frontmatterEdits, ...scriptTagsEdits].map((edit) => ({
			range: convertRange(document, edit.span),
			newText: edit.newText,
		}));
	}
}

function computeInitialIndent(document: AstroDocument, lineStart: number, options: FormattingOptions) {
	let content = document.getText();

	let i = lineStart;
	let nChars = 0;
	let tabSize = options.tabSize || 4;
	while (i < content.length) {
		let ch = content.charAt(i);
		if (ch === ' ') {
			nChars++;
		} else if (ch === '\t') {
			nChars += tabSize;
		} else {
			break;
		}
		i++;
	}
	return Math.floor(nChars / tabSize);
}

function generateIndent(level: number, options: FormattingOptions) {
	if (options.insertSpaces) {
		return repeat(' ', level * options.tabSize);
	} else {
		return repeat('\t', level);
	}
}

function repeat(value: string, count: number) {
	let s = '';
	while (count > 0) {
		if ((count & 1) === 1) {
			s += value;
		}
		value += value;
		count = count >>> 1;
	}
	return s;
}

function isWhitespaceOnly(str: string) {
	return /^\s*$/.test(str);
}
