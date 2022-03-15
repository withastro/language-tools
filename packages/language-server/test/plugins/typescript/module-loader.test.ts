import * as assert from 'assert';
import sinon from 'sinon';
import ts from 'typescript';
import * as aaS from '../../../src/plugins/typescript/astro-sys';
import { DocumentSnapshot } from '../../../src/plugins/typescript/snapshots/DocumentSnapshot';
import { createAstroModuleLoader } from '../../../src/plugins/typescript/module-loader';

describe('createSvelteModuleLoader', () => {
	afterEach(() => {
		sinon.restore();
	});

	function setup(resolvedModule: ts.ResolvedModuleFull) {
		const getAstroSnapshotStub = sinon.stub().returns(<Partial<DocumentSnapshot>>{ scriptKind: ts.ScriptKind.JSX });

		const resolveStub = sinon.stub().returns(<ts.ResolvedModuleWithFailedLookupLocations>{
			resolvedModule,
		});
		sinon.replace(ts, 'resolveModuleName', resolveStub);

		const astroSys = <any>'astroSys';
		sinon.stub(aaS, 'createAstroSys').returns(astroSys);

		const compilerOptions: ts.CompilerOptions = { strict: true, paths: { '/@/*': [] } };
		const moduleResolver = createAstroModuleLoader(getAstroSnapshotStub, compilerOptions);

		return {
			getAstroSnapshotStub,
			resolveStub,
			compilerOptions,
			moduleResolver,
			astroSys,
		};
	}

	function lastCall(stub: sinon.SinonStub<any[], any>) {
		return stub.getCall(stub.getCalls().length - 1);
	}

	it('uses tsSys for normal files', async () => {
		const resolvedModule: ts.ResolvedModuleFull = {
			extension: ts.Extension.Ts,
			resolvedFileName: 'filename.ts',
		};
		const { resolveStub, moduleResolver, compilerOptions } = setup(resolvedModule);
		const result = moduleResolver.resolveModuleNames(['./normal.ts'], 'C:/somerepo/somefile.astro');

		assert.deepStrictEqual(result, [resolvedModule]);
		assert.deepStrictEqual(lastCall(resolveStub).args, [
			'./normal.ts',
			'C:/somerepo/somefile.astro',
			compilerOptions,
			ts.sys,
		]);
	});

	it('uses tsSys for normal files part of TS aliases', async () => {
		const resolvedModule: ts.ResolvedModuleFull = {
			extension: ts.Extension.Ts,
			resolvedFileName: 'filename.ts',
		};
		const { resolveStub, moduleResolver, compilerOptions } = setup(resolvedModule);
		const result = moduleResolver.resolveModuleNames(['/@/normal'], 'C:/somerepo/somefile.astro');

		assert.deepStrictEqual(result, [resolvedModule]);
		assert.deepStrictEqual(lastCall(resolveStub).args, [
			'/@/normal',
			'C:/somerepo/somefile.astro',
			compilerOptions,
			ts.sys,
		]);
	});

	it('uses tsSys for svelte.d.ts files', async () => {
		const resolvedModule: ts.ResolvedModuleFull = {
			extension: ts.Extension.Dts,
			resolvedFileName: 'filename.d.ts',
		};
		const { resolveStub, moduleResolver, compilerOptions } = setup(resolvedModule);
		const result = moduleResolver.resolveModuleNames(['./normal.ts'], 'C:/somerepo/somefile.astro');

		assert.deepStrictEqual(result, [resolvedModule]);
		assert.deepStrictEqual(lastCall(resolveStub).args, [
			'./normal.ts',
			'C:/somerepo/somefile.astro',
			compilerOptions,
			ts.sys,
		]);
	});

	it('uses svelte module loader for virtual svelte files', async () => {
		const resolvedModule: ts.ResolvedModuleFull = {
			extension: ts.Extension.Ts,
			resolvedFileName: 'filename.astro.ts',
		};
		const { resolveStub, astroSys, moduleResolver, compilerOptions, getAstroSnapshotStub } = setup(resolvedModule);
		const result = moduleResolver.resolveModuleNames(['./svelte.astro'], 'C:/somerepo/somefile.astro');

		assert.deepStrictEqual(result, [
			<ts.ResolvedModuleFull>{
				extension: ts.Extension.Jsx,
				resolvedFileName: 'filename.astro',
				isExternalLibraryImport: undefined,
			},
		]);
		assert.deepStrictEqual(lastCall(resolveStub).args, [
			'./svelte.astro',
			'C:/somerepo/somefile.astro',
			compilerOptions,
			astroSys,
		]);
		assert.deepStrictEqual(lastCall(getAstroSnapshotStub).args, ['filename.astro']);
	});

	it('uses svelte module loader for virtual svelte files with TS path aliases', async () => {
		const resolvedModule: ts.ResolvedModuleFull = {
			extension: ts.Extension.Ts,
			resolvedFileName: 'filename.astro.ts',
		};
		const { resolveStub, astroSys, moduleResolver, compilerOptions, getAstroSnapshotStub } = setup(resolvedModule);
		const result = moduleResolver.resolveModuleNames(['/@/svelte.astro'], 'C:/somerepo/somefile.astro');

		assert.deepStrictEqual(result, [
			<ts.ResolvedModuleFull>{
				extension: ts.Extension.Jsx,
				resolvedFileName: 'filename.astro',
				isExternalLibraryImport: undefined,
			},
		]);
		assert.deepStrictEqual(lastCall(resolveStub).args, [
			'/@/svelte.astro',
			'C:/somerepo/somefile.astro',
			compilerOptions,
			astroSys,
		]);
		assert.deepStrictEqual(lastCall(getAstroSnapshotStub).args, ['filename.astro']);
	});

	it('uses cache if module was already resolved before', async () => {
		const resolvedModule: ts.ResolvedModuleFull = {
			extension: ts.Extension.Ts,
			resolvedFileName: 'filename.ts',
		};
		const { resolveStub, moduleResolver } = setup(resolvedModule);
		// first call
		moduleResolver.resolveModuleNames(['./normal.ts'], 'C:/somerepo/somefile.astro');
		// second call, which should be from cache
		const result = moduleResolver.resolveModuleNames(['./normal.ts'], 'C:/somerepo/somefile.astro');

		assert.deepStrictEqual(result, [resolvedModule]);
		assert.deepStrictEqual(resolveStub.callCount, 1);
	});
});
