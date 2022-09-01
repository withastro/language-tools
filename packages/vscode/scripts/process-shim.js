export let process = {
	platform: () => JSON.stringify('web'),
	env: JSON.stringify({}),
	'env.BROWSER_ENV': JSON.stringify('true'),
};
