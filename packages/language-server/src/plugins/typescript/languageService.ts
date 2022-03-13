import { AstroDocument } from '../../core/documents';
import { dirname } from 'path';
import * as ts from 'typescript';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { normalizePath } from '../../utils';

export interface LanguageServiceContainer {
	readonly tsconfigPath: string;
	readonly compilerOptions: ts.CompilerOptions;
	/**
	 * @internal Public for tests only
	 */
	readonly snapshotManager: SnapshotManager;
	getService(): ts.LanguageService;
	updateSnapshot(documentOrFilePath: Document | string): DocumentSnapshot;
	deleteSnapshot(filePath: string): void;
	updateProjectFiles(): void;
	updateTsOrJsFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void;
	/**
	 * Checks if a file is present in the project.
	 * Unlike `fileBelongsToProject`, this doesn't run a file search on disk.
	 */
	hasFile(filePath: string): boolean;
	/**
	 * Careful, don't call often, or it will hurt performance.
	 * Only works for TS versions that have ScriptKind.Deferred
	 */
	fileBelongsToProject(filePath: string): boolean;
}

export interface LanguageServiceDocumentContext {
	createDocument: (fileName: string, content: string) => Document;
	globalSnapshotsManager: GlobalSnapshotsManager;
}

export function createLanguageService(tsconfigPath: string, createDocument: CreateDocument) {
	const workspacePath = tsconfigPath ? dirname(tsconfigPath) : '';

	return {
		tsconfigPath,
	};

	function getParsedTSConfig() {
		let configJson = (tsconfigPath && ts.readConfigFile(tsconfigPath, ts.sys.readFile).config) || {};

		// Everything here will always, unconditionally, be in the resulting config
		const forcedCompilerOptions: ts.CompilerOptions = {
			// Our TSX is currently not typed, which unfortunately means that we can't support `noImplicitAny`
			noImplicitAny: false,

			noEmit: true,
			declaration: false,

			allowJs: true,
			jsx: ts.JsxEmit.Preserve,
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ESNext,
		};

		const project = ts.parseJsonConfigFileContent(
			configJson,
			ts.sys,
			workspacePath,
			forcedCompilerOptions,
			tsconfigPath,
			undefined,
			[
				{ extension: '.vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
				{ extension: '.svelte', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
				{ extension: '.astro', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
			]
		);

		return {
			...project,
			fileNames: project.fileNames.map(normalizePath),
		};
	}
}

function getDefaultCompilerOptions(): ts.CompilerOptions {
	return {
		maxNodeModuleJsDepth: 2,
		allowSyntheticDefaultImports: true,
		types: ['astro/env'],
	};
}

function getDefaultExclude() {
	return ['dist', 'node_modules'];
}
