import { Position } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { expect } from 'chai';
import { before, describe, it } from 'mocha';
import { getLanguageServer } from '../server.js';

describe('TypeScript Addons - Completions', async () => {
	let serverHandle: LanguageServerHandle;

	before(async () => ({ serverHandle } = await getLanguageServer()));
	it('Can provide neat snippets', async () => {
		const document = await serverHandle.openUntitledDocument('---\nprerender\n---', 'astro');
		const completions = await serverHandle.sendCompletionRequest(
			document.uri,
			Position.create(1, 10)
		);

		const prerenderCompletions = completions?.items.filter((item) => item.label === 'prerender');
		expect(prerenderCompletions).to.not.be.empty;
		expect(prerenderCompletions?.[0].data.serviceId).to.equal('typescriptaddons');
	});
});
