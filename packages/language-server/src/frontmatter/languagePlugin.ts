import * as path from 'node:path';
import {
	type CodeMapping,
	type LanguagePlugin,
	type VirtualCode,
	forEachEmbeddedCode,
} from '@volar/language-core';
import type ts from 'typescript';
import type { URI } from 'vscode-uri';
import YAML, { parseDocument, isScalar, LineCounter } from 'yaml';
import type { AstroInstall } from '../utils.js';

export function getFrontmatterLanguagePlugin(
	astroInstall: AstroInstall | undefined,
	ts: typeof import('typescript')
): LanguagePlugin<URI, MarkdownVirtualCode> {
	return {
		getLanguageId(scriptId) {
			if (scriptId.path.endsWith('.md')) {
				return 'markdown';
			}
		},
		createVirtualCode(scriptId, languageId, snapshot) {
			if (languageId === 'markdown') {
				const fileName = scriptId.fsPath.replace(/\\/g, '/');
				return new MarkdownVirtualCode(fileName, snapshot);
			}
		},
		typescript: {
			extraFileExtensions: [{ extension: 'md', isMixedContent: true, scriptKind: 7 }],
			getServiceScript(astroCode) {
				for (const code of forEachEmbeddedCode(astroCode)) {
					if (code.id === 'frontmatter') {
						return {
							code,
							extension: '.ts',
							scriptKind: 3 satisfies ts.ScriptKind.TS,
						};
					}
				}
				return undefined;
			},
		},
	};
}

export class MarkdownVirtualCode implements VirtualCode {
	id: string = 'markdown';
	languageId: string = 'markdown';
	mappings!: CodeMapping[];
	embeddedCodes!: VirtualCode[];

	lastValidContent: {
		source: string;
		generated: string;
		mappings: CodeMapping[];
	} = {
		source: '',
		generated: '',
		mappings: [],
	};

	constructor(
		public fileName: string,
		public snapshot: ts.IScriptSnapshot
	) {
		this.mappings = [
			{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [this.snapshot.getLength()],
				data: {
					verification: true,
					completion: true,
					semantic: true,
					navigation: true,
					structure: true,
					format: true,
				},
			},
		];

		this.embeddedCodes = [];

		const frontmatter = this.snapshot.getText(
			4,
			this.snapshot.getText(0, this.snapshot.getLength()).indexOf('---', 3)
		);
		const frontmatterMappings: CodeMapping[] = [];
		const lineCounter = new LineCounter();
		const frontmatterContent = parseDocument(frontmatter, {
			keepSourceTokens: true,
			lineCounter: lineCounter,
			strict: false,
			logLevel: 'silent',
		});

		let resultText = 'import type { InferInputSchema } from "astro:content";\n\nconst schema = ({\n';
		let contentText = '';

		if (frontmatterContent.errors.length > 0) {
			// Add the raw content to the previous valid content
			contentText = this.lastValidContent.generated;

			frontmatterMappings.push(...this.lastValidContent.mappings);
		} else {
			contentText = '';

			// For every parsed node, create a segment mapped to the original content
			YAML.visit(frontmatterContent, {
				Collection(key, value) {
					console.log(key, value);
				},
				Pair(key, value) {
					if (key === null) return;

					if (isScalar(value.key)) {
						// TODO: Handle more types
						if (isScalar(value.value)) {
							const valueKey = JSON.stringify(value.key.toJS(frontmatterContent));
							const valueValue = JSON.stringify(value.value.toJS(frontmatterContent));

							console.log(lineCounter.lineStarts);

							frontmatterMappings.push({
								generatedOffsets: [resultText.length, resultText.length + valueKey.length],
								sourceOffsets: [value.key.range![0] + 4, value.key.range![2] + 4],
								lengths: [0, 0],
								data: {
									verification: true,
									completion: true,
									semantic: true,
									navigation: true,
									structure: true,
									format: false,
								},
							});

							contentText += `${valueKey}: ${valueValue},\n`;
						}
					}
				},
			});

			this.lastValidContent.source = frontmatter;
			this.lastValidContent.generated = contentText;
			resultText += contentText;

			frontmatterMappings.push({
				generatedOffsets: [
					resultText.length + '}) '.length,
					resultText.length + '}) '.length + 'satisfies'.length,
				],
				sourceOffsets: [
					0,
					this.snapshot.getText(0, this.snapshot.getLength()).indexOf('---', 3) + 3,
				],
				lengths: [0, 0],
				data: {
					verification: true,
					completion: true,
					semantic: true,
					navigation: true,
					structure: true,
					format: false,
				},
			});

			this.lastValidContent.mappings = frontmatterMappings;
		}

		resultText += '}) satisfies InferInputSchema<"blog">;';

		this.embeddedCodes.push({
			id: 'frontmatter',
			languageId: 'typescript',
			snapshot: {
				getText: (start, end) => resultText.substring(start, end),
				getLength: () => resultText.length,
				getChangeRange: () => undefined,
			},
			mappings: frontmatterMappings,
		});
	}
}
