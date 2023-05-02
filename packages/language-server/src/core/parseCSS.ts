import type { ParentNode, ParseResult, Position } from '@astrojs/compiler/types.js';
import { is } from '@astrojs/compiler/utils';
import { FileKind, FileRangeCapabilities, VirtualFile } from '@volar/language-core';
import * as SourceMap from '@volar/source-map';
import * as muggle from 'muggle-string';
import type ts from 'typescript/lib/tsserverlibrary';
import type { HTMLDocument } from 'vscode-html-languageservice';

export function extractStylesheets(
	fileName: string,
	snapshot: ts.IScriptSnapshot,
	htmlDocument: HTMLDocument,
	ast: ParseResult['ast']
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
				capabilities: {
					diagnostic: false,
					documentSymbol: true,
					foldingRange: true,
					documentFormatting: false,
				},
				embeddedFiles: [],
			});
		}
	}

	const inlineStyles = findInlineStyles(ast);
	if (inlineStyles.length > 0) {
		const codes: muggle.Segment<FileRangeCapabilities>[] = [];
		for (const inlineStyle of inlineStyles) {
			codes.push('x { ');
			codes.push([
				inlineStyle.content,
				undefined,
				inlineStyle.position.start.offset + 'style="'.length,
				FileRangeCapabilities.full,
			]);
			codes.push(' }\n');
		}

		const mappings = SourceMap.buildMappings(codes);
		const text = muggle.toString(codes);

		embeddedCSSFiles.push({
			fileName: fileName + '.inline.css',
			snapshot: {
				getText: (start, end) => text.substring(start, end),
				getLength: () => text.length,
				getChangeRange: () => undefined,
			},
			capabilities: {},
			embeddedFiles: [],
			kind: FileKind.TextFile,
			mappings,
		});
	}

	return embeddedCSSFiles;
}

interface StyleAttribute {
	position: Position;
	content: string;
}

export function findInlineStyles(ast: ParseResult['ast']): StyleAttribute[] {
	const styleAttrs: StyleAttribute[] = [];

	// `@astrojs/compiler`'s `walk` method is async, so we can't use it here. Arf
	function walkDown(parent: ParentNode) {
		parent.children.forEach((child) => {
			if (is.element(child)) {
				const styleAttribute = child.attributes.find(
					(attr) => attr.name === 'style' && attr.kind === 'quoted'
				);

				if (styleAttribute && styleAttribute.position) {
					styleAttrs.push({
						position: styleAttribute.position,
						content: styleAttribute.value,
					});
				}
			}

			if (is.parent(child)) {
				walkDown(child);
			}
		});
	}

	walkDown(ast);

	return styleAttrs;
}
