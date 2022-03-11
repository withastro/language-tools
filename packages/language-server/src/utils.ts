import { URI } from 'vscode-uri';
import { Position, Range } from 'vscode-languageserver';

/** Normalizes a document URI */
export function normalizeUri(uri: string): string {
	return URI.parse(uri).toString();
}

/** Turns a URL into a normalized FS Path */
export function urlToPath(stringUrl: string): string | null {
	const url = URI.parse(stringUrl);
	if (url.scheme !== 'file') {
		return null;
	}
	return url.fsPath.replace(/\\/g, '/');
}

/** Converts a path to a URL */
export function pathToUrl(path: string) {
	return URI.file(path).toString();
}

/** Flattens an array */
export function flatten<T>(arr: T[][]): T[] {
	return arr.reduce((all, item) => [...all, ...item], []);
}

/** Clamps a number between min and max */
export function clamp(num: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, num));
}

export function isNotNullOrUndefined<T>(val: T | undefined | null): val is T {
	return val !== undefined && val !== null;
}

export function isInRange(range: Range, positionToTest: Position): boolean {
	return isBeforeOrEqualToPosition(range.end, positionToTest) && isBeforeOrEqualToPosition(positionToTest, range.start);
}

export function isBeforeOrEqualToPosition(position: Position, positionToTest: Position): boolean {
	return (
		positionToTest.line < position.line ||
		(positionToTest.line === position.line && positionToTest.character <= position.character)
	);
}
