import type { Point } from '@astrojs/compiler/types.js';
import { HTMLDocument, Node, Position, Range, TextEdit } from 'vscode-html-languageservice';
import type { FrontmatterStatus } from './core/parseAstro.js';

export function isTsDocument(languageId: string) {
	return (
		languageId === 'javascript' ||
		languageId === 'typescript' ||
		languageId === 'javascriptreact' ||
		languageId === 'typescriptreact'
	);
}

/**
 * Return true if a specific node could be a component.
 * This is not a 100% sure test as it'll return false for any component that does not match the standard format for a component
 */
export function isPossibleComponent(node: Node): boolean {
	return !!node.tag?.[0].match(/[A-Z]/) || !!node.tag?.match(/.+[.][A-Z]?/);
}

/**
 * Return if a given offset is inside the start tag of a component
 */
export function isInComponentStartTag(html: HTMLDocument, offset: number): boolean {
	const node = html.findNodeAt(offset);
	return isPossibleComponent(node) && (!node.startTagEnd || offset < node.startTagEnd);
}

/**
 * Return if a given position is inside a JSX expression
 */
export function isInsideExpression(html: string, tagStart: number, position: number) {
	const charactersInNode = html.substring(tagStart, position);
	return charactersInNode.lastIndexOf('{') > charactersInNode.lastIndexOf('}');
}

/**
 * Return if a given offset is inside the frontmatter
 */
export function isInsideFrontmatter(offset: number, frontmatter: FrontmatterStatus) {
	switch (frontmatter.status) {
		case 'closed':
			return offset > frontmatter.position.start.offset && offset < frontmatter.position.end.offset;
		case 'open':
			return offset > frontmatter.position.start.offset;
		case 'doesnt-exist':
			return false;
	}
}

/**
 * Transform a Point from the Astro compiler to an LSP Position
 */
export function PointToPosition(point: Point) {
	return Position.create(point.line, point.column);
}

/**
 * Force a range to be at the start of the frontmatter
 */
export function ensureRangeIsInFrontmatter(range: Range, frontmatter: FrontmatterStatus): Range {
	if (frontmatter.status === 'open' || frontmatter.status === 'closed') {
		const position = PointToPosition(frontmatter.position.start);
		position.line += 1;

		return Range.create(position, position);
	}

	return range;
}

export function getNewFrontmatterEdit(edit: TextEdit, newLine: string) {
	edit.newText = `---${newLine}${edit.newText}---${newLine}${newLine}`;
	edit.range = Range.create(0, 0, 0, 0);

	return edit;
}

export function getOpenFrontmatterEdit(edit: TextEdit, newLine: string) {
	edit.newText = edit.newText.startsWith(newLine)
		? `${edit.newText}---`
		: `${newLine}${edit.newText}---`;
	return edit;
}
