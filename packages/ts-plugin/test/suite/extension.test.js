// @ts-nocheck
const assert = require('assert');
const { expect } = require('chai');
const path = require('path');
const vscode = require('vscode');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('extension is enabled', async () => {
		const ext = vscode.extensions.getExtension('astro-build.astro-vscode');
		const activate = await ext?.activate();

		assert.notStrictEqual(activate, undefined);
	});

	test('can find references inside Astro files', async () => {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(__dirname, '../fixtures/script.ts')));
		const astroDoc = (await vscode.workspace.findFiles('**/*.astro'))[0];

		// TypeScript takes a while to wake up and there's unfortunately no good way to wait for it
		async function findReferences() {
			for (let i = 0; i < 1000; i++) {
				const references = await vscode.commands.executeCommand(
					'vscode.executeReferenceProvider',
					doc.uri,
					new vscode.Position(0, 18)
				);
				if (references.length > 1) {
					return references;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			throw new Error('Could not find references');
		}

		const references = await findReferences();
		expect(references).to.deep.equal([
			{
				range: new vscode.Range(1, 10, 1, 18),
				uri: astroDoc,
			},
			{
				range: new vscode.Range(0, 16, 0, 24),
				uri: doc.uri,
			},
		]);
	}).timeout(12000);
});
