import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('can load the language server', async () => {
		const ext = vscode.extensions.getExtension('astro-build.astro-vscode');
		const languageServer = (await ext?.activate()).getLanguageServer();

		assert.notStrictEqual(languageServer, undefined);
	});
});
