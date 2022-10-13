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

		const hasAstroRef = references.some((ref) => ref.uri.path.includes('MyAstroComponent.astro'));
		expect(hasAstroRef).to.be.true;
	}).timeout(12000);

	test('can get completions for Astro components', async () => {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(__dirname, '../fixtures/script.ts')));

		// TypeScript takes a while to wake up and there's unfortunately no good way to wait for it
		async function findCompletions() {
			for (let i = 0; i < 1000; i++) {
				const completions = await vscode.commands.executeCommand(
					'vscode.executeCompletionItemProvider',
					doc.uri,
					new vscode.Position(4, 12)
				);
				if (completions.items.length > 0) {
					return completions;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			throw new Error('Could not find completions');
		}

		const completions = await findCompletions();

		const items = completions.items.filter((item) => {
			return item.insertText === 'MyAstroComponent';
		});

		expect(items[0].label.label).to.equal('MyAstroComponent');
	}).timeout(12000);
});
