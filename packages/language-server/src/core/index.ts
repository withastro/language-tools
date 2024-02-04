import type { DiagnosticMessage, ParseResult } from '@astrojs/compiler/types';
import {
	forEachEmbeddedCode,
	type CodeMapping,
	type LanguagePlugin,
	type VirtualCode,
	type ExtraServiceScript,
} from '@volar/language-core';
import * as path from 'node:path';
import type ts from 'typescript';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { AstroInstall } from '../utils.js';
import { astro2tsx } from './astro2tsx';
import { FrontmatterStatus, getAstroMetadata } from './parseAstro';
import { extractStylesheets } from './parseCSS';
import { parseHTML } from './parseHTML';
import { extractScriptTags } from './parseJS.js';

export function getLanguageModule(
	astroInstall: AstroInstall | undefined,
	ts: typeof import('typescript')
): LanguagePlugin<AstroVirtualCode> {
	return {
		createVirtualCode(fileId, languageId, snapshot) {
			if (languageId === 'astro') {
				const fileName = fileId.includes('://') ? fileId.split('://')[1] : fileId;
				return new AstroVirtualCode(fileName, snapshot);
			}
		},
		updateVirtualCode(_fileId, astroCode, snapshot) {
			astroCode.update(snapshot);
			return astroCode;
		},
		typescript: {
			extraFileExtensions: [{ extension: 'astro', isMixedContent: true, scriptKind: 7 }],
			getScript(astroCode) {
				for (const code of forEachEmbeddedCode(astroCode)) {
					if (code.id === 'tsx') {
						return {
							code,
							extension: '.tsx',
							scriptKind: 4 satisfies ts.ScriptKind.TSX,
						};
					}
				}
				return undefined;
			},
			getExtraScripts(fileName, astroCode) {
				const result: ExtraServiceScript[] = [];
				for (const code of forEachEmbeddedCode(astroCode)) {
					if (code.id.endsWith('.mjs')) {
						result.push({
							fileName: fileName + '.' + code.id,
							code,
							extension: '.mjs',
							scriptKind: 1 satisfies ts.ScriptKind.JS,
						});
					}
				}
				return result;
			},
			resolveLanguageServiceHost(host) {
				return {
					...host,
					getScriptFileNames() {
						const fileNames = host.getScriptFileNames();
						return [
							...fileNames,
							...(astroInstall
								? ['./env.d.ts', './astro-jsx.d.ts'].map((filePath) =>
									ts.sys.resolvePath(path.resolve(astroInstall.path, filePath))
								)
								: []),
						];
					},
					getCompilationSettings() {
						const baseCompilationSettings = host.getCompilationSettings();
						return {
							...baseCompilationSettings,
							module: ts.ModuleKind.ESNext ?? 99,
							target: ts.ScriptTarget.ESNext ?? 99,
							jsx: ts.JsxEmit.Preserve ?? 1,
							jsxImportSource: undefined,
							jsxFactory: 'astroHTML',
							resolveJsonModule: true,
							allowJs: true,
							isolatedModules: true,
							moduleResolution:
								baseCompilationSettings.moduleResolution === ts.ModuleResolutionKind.Classic ||
									!baseCompilationSettings.moduleResolution
									? ts.ModuleResolutionKind.Node10
									: baseCompilationSettings.moduleResolution,
						};
					},
				};
			},
		},
	};
}

export class AstroVirtualCode implements VirtualCode {
	id = 'root';
	languageId = 'astro';
	mappings!: CodeMapping[];
	embeddedCodes!: VirtualCode[];
	astroMeta!: ParseResult & { frontmatter: FrontmatterStatus };
	compilerDiagnostics!: DiagnosticMessage[];
	htmlDocument!: HTMLDocument;
	scriptCodeIds!: string[];
	codegenStacks = [];

	constructor(
		public fileName: string,
		public snapshot: ts.IScriptSnapshot
	) {
		this.onSnapshotUpdated();
	}

	get hasCompilationErrors(): boolean {
		return this.compilerDiagnostics.filter((diag) => diag.severity === 1).length > 0;
	}

	public update(newSnapshot: ts.IScriptSnapshot) {
		this.snapshot = newSnapshot;
		this.onSnapshotUpdated();
	}

	onSnapshotUpdated() {
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
		this.compilerDiagnostics = [];

		this.astroMeta = getAstroMetadata(
			this.fileName,
			this.snapshot.getText(0, this.snapshot.getLength())
		);

		if (this.astroMeta.diagnostics.length > 0) {
			this.compilerDiagnostics.push(...this.astroMeta.diagnostics);
		}

		const { htmlDocument, virtualCode: htmlVirtualCode } = parseHTML(
			this.snapshot,
			this.astroMeta.frontmatter.status === 'closed'
				? this.astroMeta.frontmatter.position.end.offset
				: 0
		);
		this.htmlDocument = htmlDocument;

		const scriptTags = extractScriptTags(this.snapshot, htmlDocument, this.astroMeta.ast);

		this.scriptCodeIds = scriptTags.map((scriptTag) => scriptTag.id);

		htmlVirtualCode.embeddedCodes.push(
			...extractStylesheets(this.snapshot, htmlDocument, this.astroMeta.ast),
			...scriptTags
		);

		this.embeddedCodes = [];
		this.embeddedCodes.push(htmlVirtualCode);

		const tsx = astro2tsx(
			this.snapshot.getText(0, this.snapshot.getLength()),
			this.fileName,
			htmlDocument
		);

		this.compilerDiagnostics.push(...tsx.diagnostics);
		this.embeddedCodes.push(tsx.virtualCode);
	}
}
