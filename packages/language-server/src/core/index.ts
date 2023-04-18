import type { DiagnosticMessage, ParseResult } from '@astrojs/compiler/types';
import {
	FileCapabilities,
	FileKind,
	FileRangeCapabilities,
	type LanguageModule,
	type VirtualFile,
} from '@volar/language-core';
import * as path from 'path';
import type ts from 'typescript/lib/tsserverlibrary';
import { astro2tsx } from './astro2tsx';
import { FrontmatterStatus, getAstroAST, getFrontmatterStatus } from './parseAstro';
import { extractStylesheets } from './parseCSS';
import { parseHTML } from './parseHTML';
import { AstroInstall } from './utils';

export function getLanguageModule(
	astroInstall: AstroInstall,
	ts: typeof import('typescript/lib/tsserverlibrary.js')
): LanguageModule<AstroFile> {
	return {
		createFile(fileName, snapshot) {
			if (fileName.endsWith('.astro')) {
				return new AstroFile(fileName, snapshot);
			}
		},
		updateFile(astroFile, snapshot) {
			astroFile.update(snapshot);
		},
		proxyLanguageServiceHost(host) {
			return {
				...host,
				getScriptFileNames() {
					const fileNames = host.getScriptFileNames();
					return [
						...['./env.d.ts', './astro-jsx.d.ts'].map((filePath) =>
							path.join(astroInstall.path, filePath)
						),
						...fileNames,
					];
				},
				getCompilationSettings() {
					return {
						jsx: ts.JsxEmit.Preserve ?? 1,
						jsxImportSource: undefined,
						jsxFactory: 'astroHTML',
						...host.getCompilationSettings(),
					};
				},
			};
		},
	};
}

export class AstroFile implements VirtualFile {
	kind = FileKind.TextFile;
	capabilities = FileCapabilities.full;

	fileName!: string;
	mappings!: VirtualFile['mappings'];
	embeddedFiles!: VirtualFile['embeddedFiles'];
	astroAst!: ParseResult;
	frontmatter!: FrontmatterStatus;
	compilerDiagnostics!: DiagnosticMessage[];

	constructor(public sourceFileName: string, public snapshot: ts.IScriptSnapshot) {
		this.fileName = sourceFileName;
		this.onSnapshotUpdated();
	}

	public update(newSnapshot: ts.IScriptSnapshot) {
		this.snapshot = newSnapshot;
		this.onSnapshotUpdated();
	}

	onSnapshotUpdated() {
		this.mappings = [
			{
				sourceRange: [0, this.snapshot.getLength()],
				generatedRange: [0, this.snapshot.getLength()],
				data: FileRangeCapabilities.full,
			},
		];

		this.astroAst = getAstroAST(this.snapshot.getText(0, this.snapshot.getLength()));
		this.frontmatter = getFrontmatterStatus(this.astroAst);
		const tsx = astro2tsx(this.snapshot.getText(0, this.snapshot.getLength()), this.fileName);

		this.compilerDiagnostics = tsx.diagnostics;

		const { htmlDocument, virtualFile: htmlVirtualFile } = parseHTML(
			this.fileName,
			this.snapshot,
			this.frontmatter.status === 'closed' ? this.frontmatter.position.end.offset : 0
		);

		this.embeddedFiles = [];
		this.embeddedFiles.push(htmlVirtualFile);
		this.embeddedFiles.push(...extractStylesheets(this.fileName, this.snapshot, htmlDocument));
		this.embeddedFiles.push(tsx.virtualFile);
	}
}
