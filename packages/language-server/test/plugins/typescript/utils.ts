import ts from 'typescript';
import { join } from 'path';
import { ConfigManager } from '../../../src/core/config';
import { AstroDocument, DocumentManager } from '../../../src/core/documents';
import { pathToUrl } from '../../../src/utils';

const testDir = join(__dirname, 'fixtures');

export function createEnvironment(filePath: string) {
	const docManager = new DocumentManager((astroDocument) => new AstroDocument(astroDocument.uri, astroDocument.text));
	const configManager = new ConfigManager();
	const document = openDocument(filePath, docManager);

	return { document, docManager, configManager, testDir: pathToUrl(testDir) };
}

function openDocument(filePath: string, docManager: DocumentManager) {
	const path = join(testDir, filePath);

	if (!ts.sys.fileExists(path)) {
		return null;
	}

	const document = docManager.openDocument({
		uri: pathToUrl(path),
		text: ts.sys.readFile(path) || '',
	});
	return document;
}
