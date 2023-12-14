import { Position } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { expect } from 'chai';
import { describe } from 'mocha';
import { getLanguageServer } from '../server.js';

describe('HTML - Hover', () => {
	let serverHandle: LanguageServerHandle;

	before(async () => ({ serverHandle } = await getLanguageServer()));

	it('Can provide hover for HTML tags', async () => {
		const document = await serverHandle.openUntitledDocument(`<q`, 'astro');
		const hover = await serverHandle.sendHoverRequest(document.uri, Position.create(0, 2));

		expect(hover).to.not.be.null;
	});

	it('Can provide hover for HTML attributes', async () => {
		const document = await serverHandle.openUntitledDocument(`<blockquote c`, 'astro');
		const hover = await serverHandle.sendHoverRequest(document.uri, Position.create(0, 13));

		expect(hover).to.not.be.null;
	});
});
