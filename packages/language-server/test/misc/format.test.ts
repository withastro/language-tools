import { Range } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { expect } from 'chai';
import { describe } from 'mocha';
import { getLanguageServer } from '../server.js';

describe('Formatting', () => {
	let serverHandle: LanguageServerHandle;

	before(async () => ({ serverHandle } = await getLanguageServer()));

	it('Can format document', async () => {
		const document = await serverHandle.openUntitledTextDocument(`---\n\n\n---`, 'astro');
		const formatEdits = await serverHandle.sendDocumentFormattingRequest(document.uri, {
			tabSize: 2,
			insertSpaces: true,
		});

		expect(formatEdits).to.deep.equal([
			{
				range: Range.create(0, 0, 3, 3),
				newText: '---\n\n---\n',
			},
		]);
	});
});
