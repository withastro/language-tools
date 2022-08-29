import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const defaultTsdk = 'node_modules/typescript/lib';

export function getWorkspaceTypescriptPath(tsdk: string, workspaceFolderFsPaths: string[]) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = findTypescriptModulePathInLib(tsdk);
		if (tsPath) {
			return tsPath;
		}
	} else {
		for (const folder of workspaceFolderFsPaths) {
			const tsPath = findTypescriptModulePathInLib(path.join(folder, tsdk));
			if (tsPath) {
				return tsPath;
			}
		}
	}
}

export function getWorkspaceTypescriptLocalizedPath(tsdk: string, lang: string, workspaceFolderFsPaths: string[]) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = findTypescriptLocalizedPathInLib(tsdk, lang);
		if (tsPath) {
			return tsPath;
		}
	} else {
		for (const folder of workspaceFolderFsPaths) {
			const tsPath = findTypescriptLocalizedPathInLib(path.join(folder, tsdk), lang);
			if (tsPath) {
				return tsPath;
			}
		}
	}
}

export function findTypescriptModulePathInLib(lib: string) {
	const tsserverlibrary = path.join(lib, 'tsserverlibrary.js');
	const typescript = path.join(lib, 'typescript.js');
	const tsserver = path.join(lib, 'tsserver.js');

	if (fs.existsSync(tsserverlibrary)) {
		return tsserverlibrary;
	}
	if (fs.existsSync(typescript)) {
		return typescript;
	}
	if (fs.existsSync(tsserver)) {
		return tsserver;
	}
}

export function findTypescriptLocalizedPathInLib(lib: string, lang: string) {
	const localized = path.join(lib, lang, 'diagnosticMessages.generated.json');

	if (fs.existsSync(localized)) {
		return localized;
	}
}

export function getVscodeTypescriptPath(appRoot: string) {
	return path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', 'typescript.js');
}

export function getVscodeTypescriptLocalizedPath(appRoot: string, lang: string): string | undefined {
	const tsPath = path.join(
		appRoot,
		'extensions',
		'node_modules',
		'typescript',
		'lib',
		lang,
		'diagnosticMessages.generated.json'
	);

	if (fs.existsSync(tsPath)) {
		return tsPath;
	}
}

export function getCurrentTsPaths(context: vscode.ExtensionContext) {
	if (isUseWorkspaceTsdk(context)) {
		const workspaceTsPaths = getWorkspaceTsPaths(true);
		if (workspaceTsPaths) {
			return { ...workspaceTsPaths, isWorkspacePath: true };
		}
	}
	return { ...getVscodeTsPaths(), isWorkspacePath: false };
}

function getWorkspaceTsPaths(useDefault = false) {
	let tsdk = getTsdk();
	if (!tsdk && useDefault) {
		tsdk = defaultTsdk;
	}
	if (tsdk) {
		const fsPaths = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
		const tsPath = getWorkspaceTypescriptPath(tsdk, fsPaths);
		if (tsPath) {
			return {
				serverPath: tsPath,
				localizedPath: getWorkspaceTypescriptLocalizedPath(tsdk, vscode.env.language, fsPaths),
			};
		}
	}
}

function getVscodeTsPaths() {
	const nightly = vscode.extensions.getExtension('ms-vscode.vscode-typescript-next');
	if (nightly) {
		const tsLibPath = path.join(nightly.extensionPath, 'node_modules/typescript/lib');
		const serverPath = findTypescriptModulePathInLib(tsLibPath);
		if (serverPath) {
			return {
				serverPath,
				localizedPath: findTypescriptLocalizedPathInLib(tsLibPath, vscode.env.language),
			};
		}
	}
	return {
		serverPath: getVscodeTypescriptPath(vscode.env.appRoot),
		localizedPath: getVscodeTypescriptLocalizedPath(vscode.env.appRoot, vscode.env.language),
	};
}

function getTsdk() {
	const tsConfigs = vscode.workspace.getConfiguration('typescript');
	const tsdk = tsConfigs.get<string>('tsdk');
	return tsdk;
}

function isUseWorkspaceTsdk(context: vscode.ExtensionContext) {
	return context.workspaceState.get('typescript.useWorkspaceTsdk', false);
}
