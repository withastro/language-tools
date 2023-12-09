import { Position } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { expect } from 'chai';
import { before, describe, it } from 'mocha';
import { getLanguageServer } from '../server.js';

describe('TypeScript - Completions', async () => {
	let serverHandle: LanguageServerHandle;

	before(async () => ({ serverHandle } = await getLanguageServer()));

	it('Can get completions in the frontmatter', async () => {
		const document = await serverHandle.openUntitledTextDocument('---\nc\n---', 'astro');
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(1, 1)
		);

		expect(completions?.items).to.not.be.empty;
	});

	it('Can get completions in the template', async () => {
		const document = await serverHandle.openUntitledTextDocument('{c}', 'astro');
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(0, 1)
		);

		expect(completions?.items).to.not.be.empty;
	});

	it('sort completions starting with `astro:` higher than other imports', async () => {
		const document = await serverHandle.openUntitledTextDocument('<Image', 'astro');
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(0, 6)
		);

		const imageCompletion = completions?.items.find(
			(item) => item.labelDetails?.description === 'astro:assets'
		);

		expect(imageCompletion?.sortText).to.equal('\x00￿16');
	});
});
