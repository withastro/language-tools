import {
	FileCapabilities,
	FileKind,
	FileRangeCapabilities,
	VirtualFile,
} from '@volar/language-core';
import type ts from 'typescript/lib/tsserverlibrary';
import type { HTMLDocument } from 'vscode-html-languageservice';

export function extractStylesheets(
	fileName: string,
	snapshot: ts.IScriptSnapshot,
	htmlDocument: HTMLDocument
): VirtualFile[] {
	const embeddedCSSFiles: VirtualFile['embeddedFiles'] = [];
	for (const [index, root] of htmlDocument.roots.entries()) {
		if (root.tag === 'style' && root.startTagEnd !== undefined && root.endTagStart !== undefined) {
			const styleText = snapshot.getText(root.startTagEnd, root.endTagStart);
			embeddedCSSFiles.push({
				fileName: fileName + `.${index}.css`,
				kind: FileKind.TextFile,
				snapshot: {
					getText: (start, end) => styleText.substring(start, end),
					getLength: () => styleText.length,
					getChangeRange: () => undefined,
				},
				mappings: [
					{
						sourceRange: [root.startTagEnd, root.endTagStart],
						generatedRange: [0, styleText.length],
						data: FileRangeCapabilities.full,
					},
				],
				capabilities: FileCapabilities.full,
				embeddedFiles: [],
			});
		}
	}

	return embeddedCSSFiles;
}
