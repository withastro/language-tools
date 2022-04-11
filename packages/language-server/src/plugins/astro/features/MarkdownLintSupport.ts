import {
	CodeAction,
	CodeActionContext,
	CodeActionKind,
	Command,
	Diagnostic,
	DiagnosticSeverity,
	Position,
	Range,
	TextDocumentEdit,
	TextEdit,
	WorkspaceEdit,
} from 'vscode-languageserver-types';
import { AstroDocument, TagInformation } from '../../../core/documents';
import type { CodeActionsProvider, DiagnosticsProvider, Resolvable } from '../../interfaces';
import { sync as markdownlint, LintResults, FixInfo } from 'markdownlint';
import { flatten } from 'lodash';

interface DiagnosticData {
	fixInfo: FixInfo;
	ruleUrl: string;
}

export class MarkdownLintSupport implements DiagnosticsProvider, CodeActionsProvider {
	getCodeActions(document: AstroDocument, range: Range, context: CodeActionContext): Resolvable<CodeAction[]> {
		// Adapted from https://github.com/DavidAnson/vscode-markdownlint/blob/522848a8cfe336bbc58056689e1a09f7dc8564f5/extension.js#L618
		const mdlintDiagnostics = context.diagnostics.filter((diagnostic) => diagnostic.source === 'markdownlint');

		const actions: CodeAction[] = [];
		mdlintDiagnostics.forEach((diagnostic) => {
			const ruleNameAlias = diagnostic.message.split(':')[0];
			const diagnosticData = diagnostic.data as DiagnosticData;

			if (diagnosticData.fixInfo) {
				const fixTitle = 'Fix this violation of ' + ruleNameAlias;
				const fixInfo = diagnosticData.fixInfo as FixInfo;

				const lineNumber = fixInfo.lineNumber || diagnostic.range.start.line + 1;
				const fixedText = applyFix(document.lines[lineNumber], fixInfo);

				// Unlike in a Markdown file, our line might not really start at 0 due to indentation
				const dedentRange = Range.create(Position.create(range.start.line, 0), range.end);

				let textEdit = TextEdit.replace(dedentRange, fixedText!);

				// If fixedText is not a string, it means we got a delete quickfix on our hands
				if (typeof fixedText !== 'string') {
					let deleteRange = range;
					if (lineNumber === 1) {
						if (document.lineCount > 1) {
							const nextLine = document.lines[range.end.line + 1];
							deleteRange.end = Position.create(range.end.line + 1, nextLine.length);
						}
					} else {
						const previousLine = document.lines[range.end.line - 1];
						deleteRange.start = Position.create(range.end.line - 1, previousLine.length);
					}

					textEdit = TextEdit.del(deleteRange);
				}

				const edit: WorkspaceEdit = {
					documentChanges: [
						TextDocumentEdit.create(
							{
								version: document.version,
								uri: document.uri,
							},
							[textEdit]
						),
					],
				};

				const action = CodeAction.create(fixTitle, edit, CodeActionKind.QuickFix);

				action.diagnostics = [diagnostic];
				action.isPreferred = true;

				addToActions(action);
			}

			// Add info command
			const infoTitle = 'More information about ' + ruleNameAlias;
			const infoAction = CodeAction.create(
				infoTitle,
				{
					title: infoTitle,
					command: 'vscode.open',
					arguments: [diagnosticData.ruleUrl],
				} as Command,
				CodeActionKind.QuickFix
			);
			infoAction.diagnostics = [diagnostic];
			addToActions(infoAction);
		});

		if (mdlintDiagnostics.length > 0) {
			// Add config command
			const configTitle = 'Details about configuring markdownlint rules';
			const configAction = CodeAction.create(
				configTitle,
				{
					title: configTitle,
					command: 'vscode.open',
					arguments: ['https://github.com/DavidAnson/vscode-markdownlint#configure'],
				} as Command,
				CodeActionKind.QuickFix
			);

			addToActions(configAction);
		}

		return actions;

		function applyFix(line: string, fixInfo: FixInfo) {
			const { editColumn, deleteCount, insertText } = normalizeFixInfo(fixInfo);
			const editIndex = editColumn - 1;
			return fixInfo.deleteCount === -1
				? null
				: line.slice(0, editIndex) + insertText.replace(/\n/g, '\n') + line.slice(editIndex + deleteCount);
		}

		/**
		 * Normalizes the fields of a FixInfo instance.
		 *
		 * @param {Object} fixInfo RuleOnErrorFixInfo instance.
		 * @param {number} [lineNumber] Line number.
		 * @returns {Object} Normalized RuleOnErrorFixInfo instance.
		 */
		function normalizeFixInfo(fixInfo: FixInfo): any {
			return {
				lineNumber: fixInfo.lineNumber || undefined,
				editColumn: fixInfo.editColumn || 1,
				deleteCount: fixInfo.deleteCount || 0,
				insertText: fixInfo.insertText || '',
			};
		}

		function addToActions(action: CodeAction) {
			if (!context.only || context.only.includes(action.kind ?? '')) {
				actions.push(action);
			}
		}
	}

	getDiagnostics(document: AstroDocument): Resolvable<Diagnostic[]> {
		const markdownTags = document.markdownTags;

		const result = {};

		markdownTags.forEach((markdownTag, index) => {
			const lint = markdownlint({ strings: { [index]: markdownTag.content }, resultVersion: 3 });
			Object.assign(result, lint);
		});

		return this.mdLintToDiagnostic(document, result, markdownTags);
	}

	mdLintToDiagnostic(document: AstroDocument, lint: LintResults, markdownTags: TagInformation[]): Diagnostic[] {
		const diagnostics = Object.entries(lint).map(([key, results]) => {
			const offset = markdownTags[parseInt(key)].startPos.line;

			return results.map((result) => {
				// Adapted from https://github.com/DavidAnson/vscode-markdownlint/blob/522848a8cfe336bbc58056689e1a09f7dc8564f5/extension.js#L556

				let message = result.ruleNames.join('/') + ': ' + result.ruleDescription;
				if (result.errorDetail) {
					message += ' [' + result.errorDetail + ']';
				}

				const line = offset + result.lineNumber - 1;
				const lineLength = document.lines[line].length;

				const diagnostic = Diagnostic.create(
					Range.create(line, document.lines[line].search(/\S|$/), line, lineLength),
					message,
					DiagnosticSeverity.Warning,
					result.ruleNames[0],
					'markdownlint'
				);

				// Add link to markdownlint's documentation for the code
				diagnostic.codeDescription = {
					href: result.ruleInformation,
				};

				if (result.fixInfo && result.fixInfo.lineNumber) {
					result.fixInfo.lineNumber = line;
				}

				diagnostic.data = { fixInfo: result.fixInfo || undefined, ruleUrl: result.ruleInformation } as DiagnosticData;

				return diagnostic;
			});
		});

		return flatten(diagnostics);
	}
}
