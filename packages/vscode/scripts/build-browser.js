const { watchMode } = require('./utils.js');
const isDev = process.argv.includes('--watch');

require('esbuild')
	.build({
		entryPoints: {
			client: './src/browser.ts',
		},
		bundle: true,
		sourcemap: isDev ? true : false,
		outdir: './dist/browser',
		external: ['vscode'],
		format: 'cjs',
		tsconfig: './tsconfig.json',
		minify: isDev ? false : true,
		watch: isDev ? watchMode : false,
	})
	.catch(() => process.exit(1));

require('esbuild').build({
	entryPoints: {
		server: '../language-server/dist/browser.js',
	},
	bundle: true,
	sourcemap: isDev ? true : false,
	outdir: './dist/browser',
	platform: 'browser',
	format: 'iife',
	tsconfig: './tsconfig.json',
	minify: isDev ? false : true,
	watch: isDev ? watchMode : false,
	inject: ['./scripts/process-shim.js'],
	plugins: [
		{
			name: 'node-deps',
			setup(build) {
				build.onResolve({ filter: /^vscode-.*-languageservice/ }, (args) => {
					const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] });
					const pathEsm = pathUmdMay.replace('/umd/', '/esm/');
					return { path: pathEsm };
				});
				build.onResolve({ filter: /^@vscode\/emmet-helper$/ }, (args) => {
					const pathCjsMay = require.resolve(args.path, { paths: [args.resolveDir] });
					const pathEsm = pathCjsMay.replace('/cjs/', '/esm/');
					return { path: pathEsm };
				});
				build.onResolve({ filter: /^path$/ }, (args) => {
					const pathBrowserify = require.resolve('path-browserify', {
						paths: [__dirname],
					});
					return { path: pathBrowserify };
				});
			},
		},
	],
});
