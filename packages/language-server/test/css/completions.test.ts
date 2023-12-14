import { Position } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { expect } from 'chai';
import { describe } from 'mocha';
import { getLanguageServer } from '../server.js';

describe('CSS - Completions', () => {
	let serverHandle: LanguageServerHandle;

	before(async () => ({ serverHandle } = await getLanguageServer()));

	it('Can provide completions for CSS properties', async () => {
		const document = await serverHandle.openUntitledDocument(
			`<style>.foo { colo }</style>`,
			'astro'
		);
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(0, 18)
		);

		expect(completions!.items).to.not.be.empty;
		expect(completions!.items[0].data.serviceId).to.equal('css');
	});

	it('Can provide completions for CSS values', async () => {
		const document = await serverHandle.openUntitledDocument(
			`<style>.foo { color: re }</style>`,
			'astro'
		);
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(0, 21)
		);

		expect(completions!.items).to.not.be.empty;
		expect(completions!.items[0].data.serviceId).to.equal('css');
	});
});
