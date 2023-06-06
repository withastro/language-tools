import { CodeAction, Range, TextDocumentEdit } from '@volar/language-server';
import type { TextDocument } from 'vscode-html-languageservice';
import { URI } from 'vscode-uri';
import type { AstroFile } from '../../core/index.js';
import {
	PointToPosition,
	ensureRangeIsInFrontmatter,
	getNewFrontmatterEdit,
	getOpenFrontmatterEdit,
} from '../../utils.js';

// Q: Why provideCodeActions instead of resolveCodeAction?
// A: TypeScript actions are already fully resolved in provideCodeActions, so editors won't call resolveCodeAction at all.
export function enhancedProvideCodeActions(
	codeActions: CodeAction[],
	file: AstroFile,
	document: TextDocument,
	originalDocument: TextDocument,
	newLine: string
): CodeAction[] {
	codeActions = codeActions.map((codeAction) => {
		if (!codeAction.edit) return codeAction;
		if (file.scriptFiles.includes(URI.parse(originalDocument.uri).path)) return codeAction;

		codeAction.edit.documentChanges = codeAction.edit.documentChanges?.map((change) => {
			if (TextDocumentEdit.is(change)) {
				change.edits = change.edits.map((edit) => {
					// Move code actions adding new imports to the frontmatter, as by default they'll be outside of it
					// TODO: This is a bit brittle, but we're unfortunately too late into the process to be able to tell the `fixName`
					// Maybe contribute upstream to pass the `fixName` through `data`?
					if (edit.newText.trim().startsWith('import ')) {
						if (file.astroMeta.frontmatter.status === 'doesnt-exist') {
							return getNewFrontmatterEdit(edit, newLine);
						}

						if (file.astroMeta.frontmatter.status === 'open') {
							return getOpenFrontmatterEdit(edit, newLine);
						}

						edit.range = ensureRangeIsInFrontmatter(edit.range, file.astroMeta.frontmatter);
						if (edit.range.start.line === 0 && edit.range.start.character === 0) {
							edit.newText = newLine + edit.newText;
						}
					}

					// Some code actions will insert code at the end of the generated TSX file, so we'll manually
					// redirect it to the end of the frontmatter instead, or create a frontmatter if one doesn't exist
					if (edit.range.start.line > document.lineCount) {
						switch (file.astroMeta.frontmatter.status) {
							case 'open':
								return getOpenFrontmatterEdit(edit, newLine);
							case 'closed':
								const position = PointToPosition(file.astroMeta.frontmatter.position.end);
								position.character = 0;
								edit.range = Range.create(position, position);
								return edit;
							case 'doesnt-exist':
								return getNewFrontmatterEdit(edit, newLine);
						}
					}

					return edit;
				});
			}
			return change;
		});

		return codeAction;
	});

	return codeActions;
}

export function enhancedResolveCodeActions(resolvedCodeAction: CodeAction) {
	if (!resolvedCodeAction.edit?.documentChanges) return resolvedCodeAction;

	resolvedCodeAction.edit.documentChanges = resolvedCodeAction.edit.documentChanges.map(
		(change) => {
			if (TextDocumentEdit.is(change)) {
				change.edits = change.edits.map((edit) => {
					console.log(edit);
					return edit;
				});
			}
			return change;
		}
	);
}
