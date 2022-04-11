try {
	module.exports = require('@astrojs/language-server/bin/nodeServer.js');
} catch {
	module.exports = require('./dist/node/server');
}
