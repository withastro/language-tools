import ts from 'typescript';
import { DocumentSnapshot } from './snapshots/DocumentSnapshot';
import { ensureRealAstroFilePath, isVirtualAstroFilePath, toRealAstroFilePath } from './utils';

/**
 * This should only be accessed by TS Astro module resolution.
 */
export function createAstroSys(getSnapshot: (fileName: string) => DocumentSnapshot) {
	const fileExistsCache = new Map<string, boolean>();

	const AstroSys: ts.System & { deleteFromCache: (path: string) => void } = {
		...ts.sys,
		fileExists(path: string) {
			path = ensureRealAstroFilePath(path);
			const exists = fileExistsCache.get(path) ?? ts.sys.fileExists(path);
			fileExistsCache.set(path, exists);
			return exists;
		},
		readFile(path: string) {
			const snapshot = getSnapshot(path);
			return snapshot.getText(0, snapshot.getLength());
		},
		readDirectory(path, extensions, exclude, include, depth) {
			const extensionsWithAstro = (extensions ?? []).concat(...['.astro', '.svelte', '.vue']);
			const result = ts.sys.readDirectory(path, extensionsWithAstro, exclude, include, depth);
			return result;
		},
		deleteFile(path) {
			fileExistsCache.delete(ensureRealAstroFilePath(path));
			return ts.sys.deleteFile?.(path);
		},
		deleteFromCache(path) {
			fileExistsCache.delete(ensureRealAstroFilePath(path));
		},
	};

	if (ts.sys.realpath) {
		const realpath = ts.sys.realpath;
		AstroSys.realpath = function (path) {
			if (isVirtualAstroFilePath(path)) {
				return realpath(toRealAstroFilePath(path)) + '.tsx';
			}
			return realpath(path);
		};
	}

	return AstroSys;
}
