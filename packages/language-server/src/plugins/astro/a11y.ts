import type { Node, ParseResult, Position } from '@astrojs/compiler';
import { is, walk } from '@astrojs/compiler/utils';
import { Diagnostic, DiagnosticSeverity, Range } from '@volar/language-server';

const diagnostics = {
	'astro/missing-alt': {
		message: () =>
			"Missing alt attribute on <img> element.\n\nThe `alt` property is important for the purpose of accessibility, without it users using screen readers or other assistive technologies won't be able to understand what your image is supposed to represent.",
	},
	'astro/empty-element': {
		message: (somethingElse: string) =>
			`Empty element.\n\nElements with no text content are inaccessible to users using screen readers or other assistive technologies.${somethingElse}`,
	},
	'astro/missing-lang': {
		message: (something: number, whatever: string) => `${something}${whatever}`,
	},
} as const satisfies Record<string, { message: (...args: any) => string | string }>;

export async function getA11YDiagnostics(ast: ParseResult['ast']): Promise<Diagnostic[]> {
	const diags: Diagnostic[] = [];
	let currentNodePosition: Position;

	// AST-based linting is not necessarily the best way to lint, but it's a start.
	walk(ast, async (node) => {
		visit(node);
		if (is.tag(node) && is.parent(node)) {
			const promises = [];
			for (const child of node.children) {
				promises.push(visit(child));
			}
			await Promise.all(promises);
		}
	});

	async function visit(node: Node) {
		currentNodePosition = node.position!;

		if (node.type === 'element') {
			if (node.name === 'img') {
				const alt = node.attributes.find((attr) => attr.name === 'alt');
				if (!alt) {
					diags.push(createA11YDiagnostic('astro/missing-alt'));
				}
			}

			if (['a', 'h1', 'h2', 'h3', 'h4', 'h5'].includes(node.name)) {
				if (node.children.length === 0) {
					diags.push(createA11YDiagnostic('astro/empty-element', ["Don't use empty elements."]));
				}
			}
		}
	}

	function createA11YDiagnostic<D extends keyof typeof diagnostics>(
		diagnostic: D,
		...args: ParametersOrEmpty<D>
	): Diagnostic {
		const diag = diagnostics[diagnostic];
		const position = currentNodePosition;
		const range = Range.create(
			position.start.line - 1 ?? 0,
			position.start.column - 1 ?? 0,
			(position?.end?.line ?? position.start.line) - 1,
			(position?.end?.column ?? position.start.column) - 1
		);

		return {
			range,
			// @ts-expect-error TypeScript is confused here because it doesn't know the exact type of `diag` here, not sure how to do it
			message: diag.message(...args),
			severity: DiagnosticSeverity.Warning,
			code: diagnostic,
			codeDescription: { href: 'https://astro.build/docs' },
		};
	}

	return diags;
}

type ParametersOrEmpty<D extends keyof typeof diagnostics> = Parameters<
	(typeof diagnostics)[D]['message']
> extends []
	? []
	: [Parameters<(typeof diagnostics)[D]['message']>];
