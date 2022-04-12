const { watchMode } = require('./utils.js');

require('esbuild')
	.build({
		entryPoints: {
			client: './src/browser.ts',
		},
		bundle: true,
		sourcemap: false,
		outdir: './dist/browser',
		external: ['vscode'],
		format: 'cjs',
		tsconfig: './tsconfig.json',
		minify: true,
		watch: process.argv.includes('--watch') ? watchMode : false,
	})
	.catch(() => process.exit(1));

require('esbuild').build({
	entryPoints: {
		server: '../language-server/dist/browser.js',
	},
	bundle: true,
	sourcemap: true,
	outdir: './dist/browser',
	external: ['typescript'],
	platform: 'browser',
	format: 'iife',
	tsconfig: './tsconfig.json',
	minify: false,
	watch: process.argv.includes('--watch') ? watchMode : false,
	define: { 'process.cwd.NODE_DEBUG': 'false' },
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
