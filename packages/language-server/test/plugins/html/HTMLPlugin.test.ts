import { expect } from 'chai';
import { Position } from 'vscode-languageserver-types';
import { ConfigManager } from '../../../src/core/config';
import { AstroDocument, DocumentManager } from '../../../src/core/documents';
import { HTMLPlugin } from '../../../src/plugins';

describe('HTML Plugin', () => {
	function setup(content: string) {
		const document = new AstroDocument('file:///hello.astro', content);
		const docManager = new DocumentManager(() => document);
		const configManager = new ConfigManager();
		const plugin = new HTMLPlugin(configManager);
		docManager.openDocument(<any>'some doc');

		return { plugin, document };
	}

	describe('provide completions', () => {
		it('for normal html', () => {
			const { plugin, document } = setup('<');

			const completions = plugin.getCompletions(document, Position.create(0, 1));
			expect(completions.items, 'Expected completions to be an array').to.be.an('array');
			expect(completions, 'Expected completions to not be empty').to.not.be.undefined;
		});

		it('for style lang in style tags', () => {
			const { plugin, document } = setup('<sty');

			const completions = plugin.getCompletions(document, Position.create(0, 4));
			expect(completions.items, 'Expected completions to be an array').to.be.an('array');
			expect(completions!.items.find((item) => item.label === 'style (lang="less")')).to.not.be.undefined;
		});

		it('does not provide completions inside of moustache tag', () => {
			const { plugin, document } = setup('<div on:click={() =>');

			const completions = plugin.getCompletions(document, Position.create(0, 20));
			expect(completions).to.be.null;

			const tagCompletion = plugin.doTagComplete(document, Position.create(0, 20));
			expect(completions).to.be.null;
		});
	});
});
