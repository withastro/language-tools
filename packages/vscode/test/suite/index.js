const path = require('node:path');
const glob = require('glob');
const { run } = require('node:test');

exports.run = async function () {
	const testsRoot = path.resolve(__dirname, '..');

	return /** @type {Promise<void>} */ (
		new Promise((resolve, reject) => {
			glob('**/**.test.js', { cwd: testsRoot }, async (err, files) => {
				if (err) {
					return reject(err);
				}

				try {
					for (const f of files) {
						require(path.resolve(testsRoot, f));
					}

					const stream = run({ concurrency: 1 });

					stream.on('test:fail', () => {
						reject(new Error('Test failed'));
					});

					stream.on('test:complete', () => {
						resolve();
					});
				} catch (error) {
					reject(error);
				}
			});
		})
	);
};
