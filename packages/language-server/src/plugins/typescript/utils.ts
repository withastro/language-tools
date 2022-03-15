import ts from 'typescript';
import { dirname, extname } from 'path';
import { pathToUrl } from '../../utils';
import { DiagnosticSeverity, Position, Range } from 'vscode-languageserver';

export function getExtensionFromScriptKind(kind: ts.ScriptKind | undefined): ts.Extension {
	switch (kind) {
		case ts.ScriptKind.JSX:
			return ts.Extension.Jsx;
		case ts.ScriptKind.TS:
			return ts.Extension.Ts;
		case ts.ScriptKind.TSX:
			return ts.Extension.Tsx;
		case ts.ScriptKind.JSON:
			return ts.Extension.Json;
		case ts.ScriptKind.JS:
		default:
			return ts.Extension.Js;
	}
}

export function findTsConfigPath(fileName: string, rootUris: string[]) {
	const searchDir = dirname(fileName);
	const path =
		ts.findConfigFile(searchDir, ts.sys.fileExists, 'tsconfig.json') ||
		ts.findConfigFile(searchDir, ts.sys.fileExists, 'jsconfig.json') ||
		'';

	// Don't return config files that exceed the current workspace context.
	return !!path && rootUris.some((rootUri) => isSubPath(rootUri, path)) ? path : '';
}

export function isSubPath(uri: string, possibleSubPath: string): boolean {
	return pathToUrl(possibleSubPath).startsWith(uri);
}

export function getScriptKindFromFileName(fileName: string): ts.ScriptKind {
	const ext = fileName.substring(fileName.lastIndexOf('.'));
	switch (ext.toLowerCase()) {
		case ts.Extension.Js:
			return ts.ScriptKind.JS;
		case ts.Extension.Jsx:
			return ts.ScriptKind.JSX;
		case ts.Extension.Ts:
			return ts.ScriptKind.TS;
		case ts.Extension.Tsx:
			return ts.ScriptKind.TSX;
		case ts.Extension.Json:
			return ts.ScriptKind.JSON;
		default:
			return ts.ScriptKind.Unknown;
	}
}

export function mapSeverity(category: ts.DiagnosticCategory): DiagnosticSeverity {
	switch (category) {
		case ts.DiagnosticCategory.Error:
			return DiagnosticSeverity.Error;
		case ts.DiagnosticCategory.Warning:
			return DiagnosticSeverity.Warning;
		case ts.DiagnosticCategory.Suggestion:
			return DiagnosticSeverity.Hint;
		case ts.DiagnosticCategory.Message:
			return DiagnosticSeverity.Information;
	}
}

export function convertRange(
	document: { positionAt: (offset: number) => Position },
	range: { start?: number; length?: number }
): Range {
	return Range.create(
		document.positionAt(range.start || 0),
		document.positionAt((range.start || 0) + (range.length || 0))
	);
}

export type FrameworkExt = 'vue' | 'svelte';

export function getFrameworkFromFilePath(filePath: string): FrameworkExt {
	return extname(filePath) as FrameworkExt;
}

export function isFrameworkFilePath(filePath: string): boolean {
	const ext = getFrameworkFromFilePath(filePath);
	return ['vue', 'svelte'].includes(ext);
}

export function isAstroFilePath(filePath: string) {
	return filePath.endsWith('.astro');
}

export function isVirtualAstroFilePath(filePath: string) {
	return filePath.endsWith('.astro.tsx');
}

export function toRealAstroFilePath(filePath: string) {
	return filePath.slice(0, -'.tsx'.length);
}

export function toVirtualAstroFilePath(filePath: string) {
	if (isVirtualAstroFilePath(filePath)) {
		return filePath;
	} else if (isAstroFilePath(filePath)) {
		return `${filePath}.tsx`;
	} else {
		return filePath;
	}
}

export function ensureRealAstroFilePath(filePath: string) {
	return isVirtualAstroFilePath(filePath) ? toRealAstroFilePath(filePath) : filePath;
}
