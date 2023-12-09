import { Position } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { expect } from 'chai';
import { describe } from 'mocha';
import { getLanguageServer } from '../server.js';

describe('HTML - Completions', () => {
	let serverHandle: LanguageServerHandle;

	before(async () => ({ serverHandle } = await getLanguageServer()));

	it('Can provide completions for HTML tags', async () => {
		const document = await serverHandle.openUntitledTextDocument(`<q`, 'astro');
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(0, 2)
		);

		expect(completions!.items).to.not.be.empty;
		expect(completions!.items[0].label).to.equal('blockquote');
		expect(completions!.items[0].data.serviceId).to.equal('html');
	});

	it('Can provide completions for HTML attributes', async () => {
		const document = await serverHandle.openUntitledTextDocument(`<blockquote c`, 'astro');
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(0, 13)
		);

		expect(completions!.items).to.not.be.empty;
		expect(completions!.items[0].label).to.equal('cite');
		expect(completions!.items[0].data.serviceId).to.equal('html');
	});
});
