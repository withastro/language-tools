import {
	CodeLens,
	LanguageServicePlugin,
	LanguageServicePluginInstance,
	Position,
	Range,
} from '@volar/language-server';
import fg from 'fast-glob';
import { dirname } from 'path';
import { isTsDocument } from '../utils.js';

export default (): LanguageServicePlugin =>
	(context): LanguageServicePluginInstance => {
		return {
			provideCodeLenses(document, token) {
				if (token.isCancellationRequested) return;
				if (!context?.typescript || !isTsDocument(document.languageId)) return;

				const ts = context.typescript.module;
				const tsProgram = context.typescript.languageService.getProgram();
				if (!tsProgram) return;

				const globcodeLens: CodeLens[] = [];
				const sourceFile = tsProgram.getSourceFile(context.uriToFileName(document.uri))!;

				function walk() {
					return ts.forEachChild(sourceFile, function cb(node): void {
						if (ts.isCallExpression(node) && node.expression.getText() === 'Astro.glob') {
							const globText = node.arguments.at(0)!.getText()!.slice(1, -1)!;

							globcodeLens.push(
								getGlobResultAsCodeLens(
									globText,
									dirname(context!.uriToFileName(document.uri)),
									document.positionAt(node.arguments.pos)
								)
							);
						}
						return ts.forEachChild(node, cb);
					});
				}

				walk();

				return globcodeLens;
			},
		};
	};

function getGlobResultAsCodeLens(globText: string, dir: string, position: Position) {
	const globResult = fg.sync(globText, {
		cwd: dir,
		onlyFiles: true,
	});

	return {
		range: Range.create(position, position),
		command: { title: `Matches ${globResult.length} files`, command: '' },
	};
}
