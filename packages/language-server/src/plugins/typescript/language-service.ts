import { AstroDocument } from '../../core/documents';
import { dirname } from 'path';
import ts from 'typescript';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { normalizePath } from '../../utils';
import { createAstroModuleLoader } from './module-loader';
import { GlobalSnapshotManager, SnapshotManager } from './snapshots/SnapshotManager';
import { ensureRealAstroFilePath, findTsConfigPath } from './utils';
import { DocumentSnapshot } from './snapshots/DocumentSnapshot';
import * as DocumentSnapshotUtils from './snapshots/utils';

export interface LanguageServiceContainer {
	readonly tsconfigPath: string;
	readonly compilerOptions: ts.CompilerOptions;
	/**
	 * @internal Public for tests only
	 */
	readonly snapshotManager: SnapshotManager;
	getService(): ts.LanguageService;
	updateSnapshot(documentOrFilePath: AstroDocument | string): DocumentSnapshot;
	deleteSnapshot(filePath: string): void;
	updateProjectFiles(): void;
	updateNonAstroFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void;
	/**
	 * Checks if a file is present in the project.
	 * Unlike `fileBelongsToProject`, this doesn't run a file search on disk.
	 */
	hasFile(filePath: string): boolean;
	/**
	 * Careful, don't call often, or it will hurt performance.
	 */
	fileBelongsToProject(filePath: string): boolean;
}

const services = new Map<string, Promise<LanguageServiceContainer>>();

export interface LanguageServiceDocumentContext {
	createDocument: (fileName: string, content: string) => AstroDocument;
	globalSnapshotManager: GlobalSnapshotManager;
}

export async function getLanguageService(
	path: string,
	workspaceUris: string[],
	docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
	const tsconfigPath = findTsConfigPath(path, workspaceUris);
	return getLanguageServiceForTsconfig(tsconfigPath, docContext);
}

/**
 * @param tsconfigPath has to be absolute
 * @param docContext
 */
export async function getLanguageServiceForTsconfig(
	tsconfigPath: string,
	docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
	let service: LanguageServiceContainer;
	if (services.has(tsconfigPath)) {
		service = await services.get(tsconfigPath)!;
	} else {
		const newService = createLanguageService(tsconfigPath, docContext);
		services.set(tsconfigPath, newService);
		service = await newService;
	}

	return service;
}

async function createLanguageService(tsconfigPath: string, docContext: LanguageServiceDocumentContext) {
	const workspaceRoot = tsconfigPath ? dirname(tsconfigPath) : '';

	// `raw` here represent the tsconfig merged with any extended config
	const { compilerOptions, fileNames: files, raw: fullConfig } = getParsedTSConfig();

	let projectVersion = 0;

	const snapshotManager = new SnapshotManager(
		docContext.globalSnapshotManager,
		files,
		fullConfig,
		workspaceRoot || process.cwd()
	);

	const astroModuleLoader = createAstroModuleLoader(getScriptSnapshot, compilerOptions);

	const host: ts.LanguageServiceHost = {
		getNewLine: () => ts.sys.newLine,
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		getDirectories: ts.sys.getDirectories,
		resolveModuleNames: astroModuleLoader.resolveModuleNames,
		readFile: astroModuleLoader.readFile,
		fileExists: astroModuleLoader.fileExists,
		readDirectory: astroModuleLoader.readDirectory,

		getCompilationSettings: () => compilerOptions,
		getCurrentDirectory: () => workspaceRoot,
		getDefaultLibFileName: ts.getDefaultLibFilePath,

		getProjectVersion: () => projectVersion.toString(),
		getScriptFileNames: () =>
			Array.from(new Set([...snapshotManager.getProjectFileNames(), ...snapshotManager.getFileNames()])),
		getScriptSnapshot,
		getScriptVersion: (fileName: string) => getScriptSnapshot(fileName).version.toString(),
	};

	let languageService = ts.createLanguageService(host);

	docContext.globalSnapshotManager.onChange(() => {
		projectVersion++;
	});

	return {
		tsconfigPath,
		compilerOptions,
		getService: () => languageService,
		updateSnapshot,
		deleteSnapshot,
		updateProjectFiles,
		updateNonAstroFile,
		hasFile,
		fileBelongsToProject,
		snapshotManager,
	};

	function deleteSnapshot(filePath: string): void {
		astroModuleLoader.deleteFromModuleCache(filePath);
		snapshotManager.delete(filePath);
	}

	function updateSnapshot(documentOrFilePath: AstroDocument | string): DocumentSnapshot {
		return typeof documentOrFilePath === 'string'
			? updateSnapshotFromFilePath(documentOrFilePath)
			: updateSnapshotFromDocument(documentOrFilePath);
	}

	function updateSnapshotFromDocument(document: AstroDocument): DocumentSnapshot {
		const filePath = document.getFilePath() || '';
		const prevSnapshot = snapshotManager.get(filePath);
		if (prevSnapshot?.version === document.version) {
			return prevSnapshot;
		}

		if (!prevSnapshot) {
			astroModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);
		}

		const newSnapshot = DocumentSnapshotUtils.createFromDocument(document);

		snapshotManager.set(filePath, newSnapshot);
		if (prevSnapshot && prevSnapshot.scriptKind !== newSnapshot.scriptKind) {
			// Restart language service as it doesn't handle script kind changes.
			languageService.dispose();
			languageService = ts.createLanguageService(host);
		}

		return newSnapshot;
	}

	function updateSnapshotFromFilePath(filePath: string): DocumentSnapshot {
		const prevSnapshot = snapshotManager.get(filePath);
		if (prevSnapshot) {
			return prevSnapshot;
		}

		astroModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);
		const newSnapshot = DocumentSnapshotUtils.createFromFilePath(filePath, docContext.createDocument);
		snapshotManager.set(filePath, newSnapshot);
		return newSnapshot;
	}

	function getScriptSnapshot(fileName: string): DocumentSnapshot {
		fileName = ensureRealAstroFilePath(fileName);

		let doc = snapshotManager.get(fileName);
		if (doc) {
			return doc;
		}

		astroModuleLoader.deleteUnresolvedResolutionsFromCache(fileName);
		doc = DocumentSnapshotUtils.createFromFilePath(fileName, docContext.createDocument);
		snapshotManager.set(fileName, doc);

		return doc;
	}

	function updateProjectFiles(): void {
		projectVersion++;
		snapshotManager.updateProjectFiles();
	}

	function hasFile(filePath: string): boolean {
		return snapshotManager.has(filePath);
	}

	function fileBelongsToProject(filePath: string): boolean {
		filePath = normalizePath(filePath);
		return hasFile(filePath) || getParsedTSConfig().fileNames.includes(filePath);
	}

	function updateNonAstroFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void {
		if (!snapshotManager.has(fileName)) {
			astroModuleLoader.deleteUnresolvedResolutionsFromCache(fileName);
		}
		snapshotManager.updateNonAstroFile(fileName, changes);
	}

	function getParsedTSConfig() {
		let configJson = (tsconfigPath && ts.readConfigFile(tsconfigPath, ts.sys.readFile).config) || getDefaultTSConfig();

		// Add astro/env types if the user doesn't have them
		if (!configJson.compilerOptions?.types) {
			configJson.compilerOptions ?? (configJson.compilerOptions = {});
			configJson.compilerOptions.types = [];
			configJson.compilerOptions.types.push('astro/env');
		} else {
			if (!configJson.compilerOptions?.types.includes('astro/env')) {
				configJson.compilerOptions.types.push('astro/env');
			}
		}

		// If the user supplied exclude, let's use theirs otherwise, use ours
		configJson.exclude ?? (configJson.exclude = getDefaultExclude());

		// Everything here will always, unconditionally, be in the resulting config
		const forcedCompilerOptions: ts.CompilerOptions = {
			// Our TSX is currently not typed, which unfortunately means that we can't support `noImplicitAny`
			noImplicitAny: false,

			noEmit: true,
			declaration: false,

			allowNonTsExtensions: true,
			allowJs: true,
			jsx: ts.JsxEmit.Preserve,
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ESNext,
		};

		const project = ts.parseJsonConfigFileContent(
			configJson,
			ts.sys,
			workspaceRoot,
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
			compilerOptions: {
				...project.options,
				...forcedCompilerOptions,
			},
		};
	}
}

/**
 * Default configuration used when the user didn't supply any
 */
function getDefaultTSConfig(): {
	compilerOptions: ts.CompilerOptions;
	types: string[];
} {
	return {
		compilerOptions: {
			maxNodeModuleJsDepth: 2,
			allowSyntheticDefaultImports: true,
		},
		types: ['astro/env'],
	};
}

function getDefaultExclude() {
	return ['dist', 'node_modules'];
}
