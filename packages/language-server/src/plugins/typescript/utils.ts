import * as ts from 'typescript';
import { dirname } from 'path';
import { pathToUrl } from '../../utils';

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
