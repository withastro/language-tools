/**
 * TODO: Upstream this
 */

//  Re-export of `@astrojs/compiler/utils` because the original is ESM-only.
import type {
	CommentNode,
	ComponentNode,
	CustomElementNode,
	DoctypeNode,
	ElementNode,
	ExpressionNode,
	FragmentNode,
	FrontmatterNode,
	LiteralNode,
	Node,
	ParentNode,
	Point,
	Position,
	RootNode,
	TagLikeNode,
	TextNode,
} from '@astrojs/compiler/types';

function guard<Type extends Node>(type: string) {
	return (node: Node): node is Type => node.type === type;
}

export const is = {
	parent(node: Node): node is ParentNode {
		return Array.isArray((node as any).children);
	},
	literal(node: Node): node is LiteralNode {
		return typeof (node as any).value === 'string';
	},
	tag(node: Node): node is TagLikeNode {
		return (
			node.type === 'element' ||
			node.type === 'custom-element' ||
			node.type === 'component' ||
			node.type === 'fragment'
		);
	},
	whitespace(node: Node): node is TextNode {
		return node.type === 'text' && node.value.trim().length === 0;
	},
	root: guard<RootNode>('root'),
	element: guard<ElementNode>('element'),
	customElement: guard<CustomElementNode>('custom-element'),
	component: guard<ComponentNode>('component'),
	fragment: guard<FragmentNode>('fragment'),
	expression: guard<ExpressionNode>('expression'),
	text: guard<TextNode>('text'),
	doctype: guard<DoctypeNode>('doctype'),
	comment: guard<CommentNode>('comment'),
	frontmatter: guard<FrontmatterNode>('frontmatter'),
};

export function createCompilerPosition(start: Point, end: Point): Position {
	return {
		start,
		end,
	};
}

export function createCompilerPoint(line: number, column: number, offset: number): Point {
	return {
		line,
		column,
		offset,
	};
}
