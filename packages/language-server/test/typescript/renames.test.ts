import path from 'node:path';
import assert from 'node:assert';
import type { RenameFilesParams } from 'vscode-languageserver-protocol';
import { WillRenameFilesRequest } from 'vscode-languageserver-protocol';
import { type LanguageServer, getLanguageServer } from '../server.js';
import { fixtureDir } from '../utils.js';
import { describe, it, before } from 'node:test';

describe('TypeScript - Renaming', async () => {
	let languageServer: LanguageServer;

	before(async () => (languageServer = await getLanguageServer()));

	it('Renames imports for files when setting is not set', async () => {
		const documentToBeRenamed = await languageServer.handle.openTextDocument(
			path.resolve(fixtureDir, 'renameThis.ts'),
			'typescript',
		);

		const newUri = documentToBeRenamed.uri.replace('renameThis.ts', 'renamed.ts');

		const edits = await languageServer.handle.connection.sendRequest(WillRenameFilesRequest.type, {
			files: [
				{
					oldUri: documentToBeRenamed.uri,
					newUri: newUri,
				},
			],
		});

		assert.notStrictEqual(edits, null);
	});

	it('Does not rename imports for files when setting is disabled', async () => {
		await languageServer.handle.updateConfiguration({
			astro: {
				updateImportsOnFileMove: {
					enabled: false,
				},
			},
		});

		const documentToBeRenamed = await languageServer.handle.openTextDocument(
			path.resolve(fixtureDir, 'renameThis.ts'),
			'typescript',
		);
		const newUri = documentToBeRenamed.uri.replace('renameThis.ts', 'renamed.ts');

		const edits = await languageServer.handle.connection.sendRequest(WillRenameFilesRequest.type, {
			files: [
				{
					oldUri: documentToBeRenamed.uri,
					newUri: newUri,
				},
			],
		} satisfies RenameFilesParams);

		assert.strictEqual(edits, null);
	});

	it('Renames imports for files when setting is enabled', async () => {
		await languageServer.handle.updateConfiguration({
			astro: {
				updateImportsOnFileMove: {
					enabled: true,
				},
			},
		});

		const documentToBeRenamed = await languageServer.handle.openTextDocument(
			path.resolve(fixtureDir, 'renameThis.ts'),
			'typescript',
		);
		const newUri = documentToBeRenamed.uri.replace('renameThis.ts', 'renamed.ts');

		const edits = await languageServer.handle.connection.sendRequest(WillRenameFilesRequest.type, {
			files: [
				{
					oldUri: documentToBeRenamed.uri,
					newUri: newUri,
				},
			],
		});

		assert.notStrictEqual(edits, null);
	});
});
