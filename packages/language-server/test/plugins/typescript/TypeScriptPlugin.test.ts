import { expect } from 'chai';
import { createEnvironment } from './utils';
import { TypeScriptPlugin } from '../../../src/plugins';

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
});
