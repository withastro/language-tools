const path = require('path');
const { runTests } = require('@vscode/test-electron');
const { downloadDirToExecutablePath } = require('./utils');
const { existsSync, readdirSync } = require('fs');

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../vscode');

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index.js');

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: ['./fixtures/fixtures.code-workspace'],
		});
	} catch {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();
