import type { ParentNode, ParseResult } from '@astrojs/compiler/types';
import { is } from '@astrojs/compiler/utils';
import type { CodeInformation, VirtualFile } from '@volar/language-core';
import * as SourceMap from '@volar/source-map';
import * as muggle from 'muggle-string';
import type ts from 'typescript/lib/tsserverlibrary';
import type { HTMLDocument, Node } from 'vscode-html-languageservice';
import type { AttributeNodeWithPosition } from './compilerUtils.js';

export function extractStylesheets(
	fileId: string,
	snapshot: ts.IScriptSnapshot,
	htmlDocument: HTMLDocument,
	ast: ParseResult['ast']
): VirtualFile[] {
	const embeddedCSSFiles: VirtualFile[] = findEmbeddedStyles(
		fileId,
		snapshot,
		htmlDocument.roots
	);

	const inlineStyles = findInlineStyles(ast);
	if (inlineStyles.length > 0) {
		const codes: muggle.Segment<CodeInformation>[] = [];
		for (const inlineStyle of inlineStyles) {
			codes.push('x { ');
			codes.push([
				inlineStyle.value,
				undefined,
				inlineStyle.position.start.offset + 'style="'.length,
				// disable all but only keep document colors
				{
					diagnostics: false,
					renameEdits: false,
					formattingEdits: false,
					definitions: false,
					references: false,
					foldingRanges: false,
					inlayHints: false,
					codeActions: false,
					symbols: false,
					selectionRanges: false,
					linkedEditingRanges: false,
					// colors: false,
					autoInserts: false,
					codeLenses: false,
					highlights: false,
					links: false,
					semanticTokens: false,
					hover: false,
					signatureHelps: false,
				},
			]);
			codes.push(' }\n');
		}

		const mappings = SourceMap.buildMappings(codes);
		const text = muggle.toString(codes);

		embeddedCSSFiles.push({
			id: fileId + '.inline.css',
			languageId: 'css',
			snapshot: {
				getText: (start, end) => text.substring(start, end),
				getLength: () => text.length,
				getChangeRange: () => undefined,
			},
			embeddedFiles: [],
			mappings,
		});
	}

	return embeddedCSSFiles;
}

/**
 * Find all embedded styles in a document.
 * Embedded styles are styles that are defined in `<style>` tags.
 */
function findEmbeddedStyles(
	fileId: string,
	snapshot: ts.IScriptSnapshot,
	roots: Node[]
): VirtualFile[] {
	const embeddedCSSFiles: VirtualFile[] = [];
	let cssIndex = 0;

	getEmbeddedCSSInNodes(roots);

	function getEmbeddedCSSInNodes(nodes: Node[]) {
		for (const [_, node] of nodes.entries()) {
			if (
				node.tag === 'style' &&
				node.startTagEnd !== undefined &&
				node.endTagStart !== undefined
			) {
				const styleText = snapshot.getText(node.startTagEnd, node.endTagStart);
				embeddedCSSFiles.push({
					id: fileId + `.${cssIndex}.css`,
					languageId: 'css',
					snapshot: {
						getText: (start, end) => styleText.substring(start, end),
						getLength: () => styleText.length,
						getChangeRange: () => undefined,
					},
					mappings: [
						{
							sourceRange: [node.startTagEnd, node.endTagStart],
							generatedRange: [0, styleText.length],
							data: {
								diagnostics: false,
								formattingEdits: false,
							},
						},
					],
					embeddedFiles: [],
				});
				cssIndex++;
			}

			if (node.children) getEmbeddedCSSInNodes(node.children);
		}
	}

	return embeddedCSSFiles;
}

/**
 * Find all inline styles using the Astro AST
 * Inline styles are styles that are defined in the `style` attribute of an element.
 * TODO: Merge this with `findEmbeddedCSS`? Unlike scripts, there's no scoping being done here, so merging all of it in
 * the same virtual file is possible, though it might make mapping more tricky.
 */
function findInlineStyles(ast: ParseResult['ast']): AttributeNodeWithPosition[] {
	const styleAttrs: AttributeNodeWithPosition[] = [];

	// `@astrojs/compiler`'s `walk` method is async, so we can't use it here. Arf
	function walkDown(parent: ParentNode) {
		if (!parent.children) return;

		parent.children.forEach((child) => {
			if (is.element(child)) {
				const styleAttribute = child.attributes.find(
					(attr) => attr.name === 'style' && attr.kind === 'quoted'
				);

				if (styleAttribute && styleAttribute.position) {
					styleAttrs.push(styleAttribute as AttributeNodeWithPosition);
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

// TODO: Provide completion for classes and IDs
export function collectClassesAndIdsFromDocument(ast: ParseResult['ast']): string[] {
	const classesAndIds: string[] = [];
	function walkDown(parent: ParentNode) {
		if (!parent.children) return;

		parent.children.forEach((child) => {
			if (is.element(child)) {
				const classOrIDAttributes = child.attributes
					.filter((attr) => attr.kind === 'quoted' && (attr.name === 'class' || attr.name === 'id'))
					.flatMap((attr) => attr.value.split(' '));

				classesAndIds.push(...classOrIDAttributes);
			}

			if (is.parent(child)) {
				walkDown(child);
			}
		});
	}

	walkDown(ast);

	return classesAndIds;
}
