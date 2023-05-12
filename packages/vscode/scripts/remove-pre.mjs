import fs from 'node:fs';

const packageJSONPath = new URL('../package.json', import.meta.url);
// `vsce` annoyingly does not support semver pre-release tags, so we'll remove it and pretend the version is not a next.
let packageJSON = await import(packageJSONPath, {
	assert: { type: 'json' },
});

packageJSON.default.version = packageJSON.default.version.replace('0-next.', '');

fs.writeFileSync(packageJSONPath, JSON.stringify(packageJSON.default, null, 2));
