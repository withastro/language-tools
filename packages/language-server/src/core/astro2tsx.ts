import { convertToTSX } from '@astrojs/compiler/sync';
import type { ConvertToTSXOptions, TSXResult } from '@astrojs/compiler/types';
import { decode } from '@jridgewell/sourcemap-codec';
import type { CodeInformation, VirtualFile } from '@volar/language-core';
import { HTMLDocument, TextDocument } from 'vscode-html-languageservice';
import { patchTSX } from './utils.js';

function safeConvertToTSX(content: string, options: ConvertToTSXOptions) {
	try {
		const tsx = convertToTSX(content, { filename: options.filename });
		return tsx;
	} catch (e) {
		console.error(
			`There was an error transforming ${options.filename} to TSX. An empty file will be returned instead. Please create an issue: https://github.com/withastro/language-tools/issues\nError: ${e}.`
		);

		return {
			code: '',
			map: {
				file: options.filename ?? '',
				sources: [],
				sourcesContent: [],
				names: [],
				mappings: '',
				version: 0,
			},
			diagnostics: [
				{
					code: 1000,
					location: { file: options.filename!, line: 1, column: 1, length: content.length },
					severity: 1,
					text: `The Astro compiler encountered an unknown error while parsing this file. Please create an issue with your code and the error shown in the server's logs: https://github.com/withastro/language-tools/issues`,
				},
			],
		} satisfies TSXResult;
	}
}

export function astro2tsx(
	input: string,
	fileId: string,
	ts: typeof import('typescript/lib/tsserverlibrary.js'),
	htmlDocument: HTMLDocument
) {
	const tsx = safeConvertToTSX(input, { filename: fileId });

	return {
		virtualFile: getVirtualFileTSX(input, tsx, fileId, ts, htmlDocument),
		diagnostics: tsx.diagnostics,
	};
}

function getVirtualFileTSX(
	input: string,
	tsx: TSXResult,
	fileId: string,
	ts: typeof import('typescript/lib/tsserverlibrary.js'),
	htmlDocument: HTMLDocument
): VirtualFile {
	tsx.code = patchTSX(tsx.code, fileId);
	const v3Mappings = decode(tsx.map.mappings);
	const sourcedDoc = TextDocument.create(fileId, 'astro', 0, input);
	const genDoc = TextDocument.create(fileId + '.tsx', 'typescriptreact', 0, tsx.code);

	const mappings: VirtualFile['mappings'] = [];

	let current:
		| {
				genOffset: number;
				sourceOffset: number;
		  }
		| undefined;

	for (let genLine = 0; genLine < v3Mappings.length; genLine++) {
		for (const segment of v3Mappings[genLine]) {
			const genCharacter = segment[0];
			const genOffset = genDoc.offsetAt({ line: genLine, character: genCharacter });
			if (current) {
				let length = genOffset - current.genOffset;
				const sourceText = input.substring(current.sourceOffset, current.sourceOffset + length);
				const genText = tsx.code.substring(current.genOffset, current.genOffset + length);
				if (sourceText !== genText) {
					length = 0;
					for (let i = 0; i < genOffset - current.genOffset; i++) {
						if (sourceText[i] === genText[i]) {
							length = i + 1;
						} else {
							break;
						}
					}
				}
				if (length > 0) {
					const lastMapping = mappings.length ? mappings[mappings.length - 1] : undefined;
					if (
						lastMapping &&
						lastMapping.generatedRange[1] === current.genOffset &&
						lastMapping.sourceRange[1] === current.sourceOffset
					) {
						lastMapping.generatedRange[1] = current.genOffset + length;
						lastMapping.sourceRange[1] = current.sourceOffset + length;
					} else {
						// Disable features inside script tags. This is a bit annoying to do, I wonder if maybe leaving script tags
						// unmapped would be better.
						const node = htmlDocument.findNodeAt(current.sourceOffset);
						const rangeCapabilities: CodeInformation =
							node.tag !== 'script'
								? {}
								: {
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
									colors: false,
									autoInserts: false,
									codeLenses: false,
									highlights: false,
									links: false,
									semanticTokens: false,
									hover: false,
									signatureHelps: false,
								  };

						mappings.push({
							sourceRange: [current.sourceOffset, current.sourceOffset + length],
							generatedRange: [current.genOffset, current.genOffset + length],
							data: rangeCapabilities,
						});
					}
				}
				current = undefined;
			}
			if (segment[2] !== undefined && segment[3] !== undefined) {
				const sourceOffset = sourcedDoc.offsetAt({ line: segment[2], character: segment[3] });
				current = {
					genOffset,
					sourceOffset,
				};
			}
		}
	}

	const ast = ts.createSourceFile('/a.tsx', tsx.code, ts.ScriptTarget.ESNext);
	if (ast.statements[0]) {
		mappings.push({
			sourceRange: [0, input.length],
			generatedRange: [ast.statements[0].getStart(ast), tsx.code.length],
			data: {},
		});
	}

	return {
		id: fileId + '.tsx',
		languageId: 'typescriptreact',
		typescript: {
			scriptKind: ts.ScriptKind.TSX,
			isLanguageServiceSourceFile: true,
		},
		snapshot: {
			getText: (start, end) => tsx.code.substring(start, end),
			getLength: () => tsx.code.length,
			getChangeRange: () => undefined,
		},
		mappings: mappings,
		embeddedFiles: [],
	};
}
