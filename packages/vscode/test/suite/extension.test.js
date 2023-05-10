const assert = require('assert');
const vscode = require('vscode');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('can activate the extension', async () => {
		const ext = vscode.extensions.getExtension('astro-build.astro-vscode');
		const activate = await ext?.activate();

		assert.notStrictEqual(activate, undefined);
	});
});
