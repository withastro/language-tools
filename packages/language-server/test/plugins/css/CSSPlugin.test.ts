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

	describe('provide document colors', () => {
		it('for normal css', () => {
			const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

			const colors = plugin.getColorPresentations(
				document,
				{
					start: { line: 0, character: 17 },
					end: { line: 0, character: 21 },
				},
				{ alpha: 1, blue: 255, green: 0, red: 0 }
			);

			expect(colors).to.deep.equal([
				{
					label: 'rgb(0, 0, 65025)',
					textEdit: {
						range: {
							end: {
								character: 21,
								line: 0,
							},
							start: {
								character: 17,
								line: 0,
							},
						},
						newText: 'rgb(0, 0, 65025)',
					},
				},
				{
					label: '#00000fe01',
					textEdit: {
						range: {
							end: {
								character: 21,
								line: 0,
							},
							start: {
								character: 17,
								line: 0,
							},
						},
						newText: '#00000fe01',
					},
				},
				{
					label: 'hsl(240, -101%, 12750%)',
					textEdit: {
						range: {
							end: {
								character: 21,
								line: 0,
							},
							start: {
								character: 17,
								line: 0,
							},
						},
						newText: 'hsl(240, -101%, 12750%)',
					},
				},
				{
					label: 'hwb(240 0% -25400%)',
					textEdit: {
						newText: 'hwb(240 0% -25400%)',
						range: {
							end: {
								character: 21,
								line: 0,
							},
							start: {
								character: 17,
								line: 0,
							},
						},
					},
				},
			]);
		});
	});
});
