import { convertToTSX } from '@astrojs/compiler/sync';
import { TSXResult } from '@astrojs/compiler/types.js';
import { decode } from '@jridgewell/sourcemap-codec';
import { FileKind, FileRangeCapabilities, VirtualFile } from '@volar/language-core';
import { TextDocument } from 'vscode-html-languageservice';

export function astro2tsx(input: string, fileName: string) {
	const tsx = convertToTSX(input, { filename: fileName });

	return {
		virtualFile: getVirtualFileTSX(input, tsx, fileName),
		diagnostics: tsx.diagnostics,
	};
}

function getVirtualFileTSX(input: string, tsx: TSXResult, fileName: string): VirtualFile {
	const v3Mappings = decode(tsx.map.mappings);
	const sourcedDoc = TextDocument.create(fileName, 'astro', 0, input);
	const genDoc = TextDocument.create(fileName + '.tsx', 'typescriptreact', 0, tsx.code);

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
						mappings.push({
							sourceRange: [current.sourceOffset, current.sourceOffset + length],
							generatedRange: [current.genOffset, current.genOffset + length],
							data: FileRangeCapabilities.full,
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

	return {
		fileName: fileName + '.tsx',
		kind: FileKind.TypeScriptHostFile,
		capabilities: {
			codeAction: true,
			documentFormatting: false,
			diagnostic: true,
			documentSymbol: true,
			inlayHint: true,
			foldingRange: true,
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
