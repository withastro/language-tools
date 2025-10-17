const assert = require('assert');
const { describe, it } = require('node:test');
const vscode = require('vscode');

describe('Extension Test Suite', () => {
	it('can activate the extension', async () => {
		const ext = vscode.extensions.getExtension('astro-build.astro-vscode');
		const activate = await ext?.activate();

		assert.notStrictEqual(activate, undefined);
	});
});
