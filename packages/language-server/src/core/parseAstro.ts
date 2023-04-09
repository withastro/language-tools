import type { Point } from '@astrojs/compiler/shared/ast';
import { parse, startRunningService } from '@astrojs/compiler/sync';
import type { ParseResult } from '@astrojs/compiler/types';
import * as path from 'path';

export async function startWASMService() {
	return await startRunningService(path.join(__dirname, '../astro.wasm'));
}

export function getAstroAST(input: string, position = true) {
	return parse(input, { position: position });
}

interface FrontmatterOpen {
	status: 'open';
	position: {
		start: Point;
		end: undefined;
	};
}

interface FrontmatterClosed {
	status: 'closed';
	position: {
		start: Point;
		end: Point;
	};
}

interface FrontmatterNull {
	status: 'doesnt-exist';
	position: undefined;
}

export type FrontmatterStatus = FrontmatterOpen | FrontmatterClosed | FrontmatterNull;

export function getFrontmatterStatus(ast: ParseResult): FrontmatterStatus {
	if (!ast.ast.children || (ast.ast.children && ast.ast.children.length === 0)) {
		return {
			status: 'doesnt-exist',
			position: undefined,
		};
	}

	if (ast.ast.children[0].type === 'frontmatter') {
		const frontmatter = ast.ast.children[0];
		if (frontmatter.position) {
			if (frontmatter.position.end) {
				return {
					status: 'closed',
					position: {
						start: frontmatter.position.start,
						end: frontmatter.position.end,
					},
				};
			}
			return {
				status: 'open',
				position: {
					start: frontmatter.position.start,
					end: undefined,
				},
			};
		}
	}

	return {
		status: 'doesnt-exist',
		position: undefined,
	};
}
