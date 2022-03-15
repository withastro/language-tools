import { expect } from 'chai';
import { ConfigManager } from '../../../src/core/config';
import { CSSPlugin } from '../../../src/plugins';
import { Position } from 'vscode-languageserver-types';
import { CompletionContext } from 'vscode-languageserver-protocol';
import { AstroDocument, DocumentManager } from '../../../src/core/documents';

describe('CSS Plugin', () => {
	function setup(content) {
		const document = new AstroDocument('file:///hello.astro', content);
		const docManager = new DocumentManager(() => document);
		const configManager = new ConfigManager();
		const plugin = new CSSPlugin(configManager);
		docManager.openDocument(<any>'some doc');

		return { plugin, document };
	}

	describe('provide completions', () => {
		it('for normal css', () => {
			const { plugin, document } = setup('<style></style>');

			const completions = plugin.getCompletions(document, Position.create(0, 7), {
				triggerCharacter: '.',
			} as CompletionContext);

			expect(completions.items, 'Expected completions to be an array').to.be.an('array');
			expect(completions, 'Expected completions to not be empty').to.not.be.undefined;
		});

		it('for :global modifier', () => {
			const { plugin, document } = setup('<style>:g</style>');

			const completions = plugin.getCompletions(document, Position.create(0, 9), {
				triggerCharacter: ':',
			} as CompletionContext);
			const globalCompletion = completions?.items.find((item) => item.label === ':global()');

			expect(globalCompletion, 'Expected completions to contain :global modifier').to.not.be.undefined;
		});
	});
});
