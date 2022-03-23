import { assert } from 'chai';
import { CompletionItemKind, CompletionList } from 'vscode-languageserver-types';
import { createEnvironment } from '../../../utils';
import { CSSPlugin } from '../../../../src/plugins';

describe('CSSPlugin#getIdClassCompletions', () => {
	function setup(content: string) {
		const env = createEnvironment(content);
		const plugin = new CSSPlugin(env.configManager);

		return {
			...env,
			plugin,
		};
	}

	it('provides css classes completion for class attribute', () => {
		const { plugin, document } = setup('<div class=></div><style>.abc{}</style>');
		assert.deepStrictEqual(plugin.getCompletions(document, { line: 0, character: 11 }), {
			isIncomplete: false,
			items: [{ label: 'abc', kind: CompletionItemKind.Keyword }],
		} as CompletionList);
	});

	it('provides css id completion for id attribute', () => {
		const { plugin, document } = setup('<div id=></div><style>#abc{}</style>');
		assert.deepStrictEqual(plugin.getCompletions(document, { line: 0, character: 8 }), {
			isIncomplete: false,
			items: [{ label: 'abc', kind: CompletionItemKind.Keyword }],
		} as CompletionList);
	});
});
