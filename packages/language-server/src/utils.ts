export function isTsDocument(languageId: string) {
	return (
		languageId === 'javascript' ||
		languageId === 'typescript' ||
		languageId === 'javascriptreact' ||
		languageId === 'typescriptreact'
	);
}
