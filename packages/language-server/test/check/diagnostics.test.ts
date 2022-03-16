import * as path from 'path';
import { expect } from 'chai';
import { AstroCheck } from '../../dist/check.js';

describe('Astro Check', async () => {
	let checker: AstroCheck;

	beforeEach(() => {
		checker = new AstroCheck(path.join(__dirname, '../..'));
	});

	it('should not find errors when using slots', async () => {
		checker.upsertDocument({
			uri: 'file://fake/file.astro',
			text: '{Astro.slots.a && <span>testing</span>}',
		});

		const [{ diagnostics }] = await checker.getDiagnostics();

		expect(diagnostics.length, 'Expected diagnostics to be empty').to.equal(0);
	});

	it('should not find errors in documents with comments', async () => {
		checker.upsertDocument({
			uri: 'file://fake/file.astro',
			text: `
				<html>
					<body class="is-preload">
						<!-- Wrapper -->
						<div id="wrapper">
							<!-- Main -->
							<div id="main"></div>
						</div>
					</body>
				</html>
			`,
		});

		const [{ diagnostics }] = await checker.getDiagnostics();

		expect(diagnostics.length, 'Expected diagnostics to be empty').to.equal(0);
	});

	it('should not find errors in documents using Fragment', async () => {
		checker.upsertDocument({
			uri: 'file://fake/file.astro',
			text: `
				<Fragment></Fragment>
			`,
		});

		const [{ diagnostics }] = await checker.getDiagnostics();

		expect(diagnostics.length, 'Expected diagnostics to be empty').to.equal(0);
	});

	it('should handle @prefixed attributes', async () => {
		checker.upsertDocument({
			uri: 'file://fake/file.astro',
			text: `<div @is="div" @click="" @dog @cat @rat>Hello, world!</div>`,
		});

		const [{ diagnostics }] = await checker.getDiagnostics();

		expect(diagnostics.length, 'Expected diagnostics to be empty').to.equal(0);
	});
});
