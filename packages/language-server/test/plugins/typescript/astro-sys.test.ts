import * as assert from 'assert';
import sinon from 'sinon';
import ts from 'typescript';
import { DocumentSnapshot } from '../../../../language-server/src/plugins/typescript/snapshots/DocumentSnapshot';
import { createAstroSys } from '../../../../language-server/src/plugins/typescript/astro-sys';

describe('Astro Sys', () => {
	afterEach(() => {
		sinon.restore();
	});

	function setupLoader() {
		const tsFile = 'const a = "ts file";';
		const astroFile = 'const a = "astro file";';

		const fileExistsStub = sinon.stub().returns(true);
		const getSnapshotStub = sinon.stub().callsFake(
			(path: string) =>
				<Partial<DocumentSnapshot>>{
					getText: () => (path.endsWith('.astro.ts') ? astroFile : tsFile),
					getLength: () => (path.endsWith('.astro.ts') ? astroFile.length : tsFile.length),
				}
		);

		sinon.replace(ts.sys, 'fileExists', fileExistsStub);
		const loader = createAstroSys(getSnapshotStub);

		return {
			tsFile,
			astroFile,
			fileExistsStub,
			getSnapshotStub,
			loader,
		};
	}

	describe('#fileExists', () => {
		it('should leave files with no .astro.ts-ending as is', async () => {
			const { loader, fileExistsStub } = setupLoader();
			loader.fileExists('../file.ts');

			assert.strictEqual(fileExistsStub.getCall(0).args[0], '../file.ts');
		});

		it('should convert .astro.ts-endings', async () => {
			const { loader, fileExistsStub } = setupLoader();
			loader.fileExists('../file.astro.ts');

			assert.strictEqual(fileExistsStub.getCall(0).args[0], '../file.astro');
		});
	});

	describe('#readFile', () => {
		it('should invoke getSnapshot for ts/js files', async () => {
			const { loader, getSnapshotStub, tsFile } = setupLoader();
			const code = loader.readFile('../file.ts')!;

			assert.strictEqual(getSnapshotStub.called, true);
			assert.strictEqual(code, tsFile);
		});

		it('should invoke getSnapshot for astro files', async () => {
			const { loader, getSnapshotStub, astroFile } = setupLoader();
			const code = loader.readFile('../file.astro.ts')!;

			assert.strictEqual(getSnapshotStub.called, true);
			assert.strictEqual(code, astroFile);
		});
	});
});
