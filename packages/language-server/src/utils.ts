import type { HTMLDocument, Node } from 'vscode-html-languageservice';

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
