// This is needed because VSCode's Emmet helper uses `process` through a dependency
export let process = {
	platform: () => JSON.stringify('web'),
	env: JSON.stringify({}),
	'env.BROWSER_ENV': JSON.stringify('true'),
};
