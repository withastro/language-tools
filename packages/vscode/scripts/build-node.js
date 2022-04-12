const { watchMode } = require('./utils.js');

require('esbuild')
	.build({
		entryPoints: {
			client: './src/node.ts',
			server: '../language-server/dist/node.js',
		},
		bundle: true,
		sourcemap: false,
		outdir: './dist/node',
		external: ['vscode'],
		format: 'cjs',
		platform: 'node',
		tsconfig: './tsconfig.json',
		minify: true,
		watch: process.argv.includes('--watch') ? watchMode : false,
		plugins: [
			{
				name: 'umd2esm',
				setup(build) {
					build.onResolve({ filter: /^(vscode-.*|estree-walker|jsonc-parse)/ }, (args) => {
						const pathUmd = require.resolve(args.path, { paths: [args.resolveDir] });
						const pathEsm = pathUmd.replace('/umd/', '/esm/');
						return { path: pathEsm };
					});
					build.onResolve({ filter: /^@vscode\/emmet-helper$/ }, (args) => {
						const pathCjsMay = require.resolve(args.path, { paths: [args.resolveDir] });
						const pathEsm = pathCjsMay.replace('/cjs/', '/esm/');
						return { path: pathEsm };
					});
				},
			},
		],
	})
	.catch(() => process.exit(1));
