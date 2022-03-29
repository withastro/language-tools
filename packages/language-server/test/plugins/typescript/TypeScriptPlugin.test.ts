import { expect } from 'chai';
import { createEnvironment } from './utils';
import { TypeScriptPlugin } from '../../../src/plugins';
import { Position } from 'vscode-languageserver-types';

// This file only contain basic tests to ensure that the TypeScript plugin does in fact calls the proper methods
// and returns something. For validity tests, please check the providers themselves in the 'features' folder

describe('TypeScript Plugin', () => {
	function setup(filePath: string) {
		const env = createEnvironment(filePath);
		const plugin = new TypeScriptPlugin(env.docManager, env.configManager, [env.testDir]);

		return {
			...env,
			plugin,
		};
	}

	describe('provide document symbols', async () => {
		it('return document symbols', async () => {
			const { plugin, document } = setup('documentSymbols/documentSymbols.astro');

			const symbols = await plugin.getDocumentSymbols(document);
			expect(symbols).to.not.be.empty;
		});

		it('should not provide documentSymbols if feature is disabled', async () => {
			const { plugin, document, configManager } = setup('documentSymbols/documentSymbols.astro');

			configManager.updateConfig(<any>{
				typescript: {
					documentSymbols: {
						enabled: false,
					},
				},
			});

			const symbols = await plugin.getDocumentSymbols(document);

			expect(configManager.enabled(`typescript.documentSymbols.enabled`)).to.be.false;
			expect(symbols).to.be.empty;
		});
	});

	describe('provide hover info', async () => {
		it('return hover info', async () => {
			const { plugin, document } = setup('hoverInfo.astro');

			const hoverInfo = await plugin.doHover(document, Position.create(1, 10));
			expect(hoverInfo).to.not.be.empty;
		});

		it('should not provide hover info if feature is disabled', async () => {
			const { plugin, document, configManager } = setup('hoverInfo.astro');

			configManager.updateConfig(<any>{
				typescript: {
					hover: {
						enabled: false,
					},
				},
			});

			const hoverInfo = await plugin.doHover(document, Position.create(1, 10));

			expect(configManager.enabled(`typescript.hover.enabled`)).to.be.false;
			expect(hoverInfo).to.be.null;
		});
	});
});
