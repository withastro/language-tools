import ts from 'typescript';
import { ConfigManager } from '../../core/config';
import { AstroDocument, DocumentManager } from '../../core/documents';
import { debounceSameArg, pathToUrl } from '../../utils';
import { getLanguageService, LanguageServiceContainer, LanguageServiceDocumentContext } from './language-service';
import { DocumentSnapshot } from './snapshots/DocumentSnapshot';
import { GlobalSnapshotManager } from './snapshots/SnapshotManager';

export class LanguageServiceManager {
	private docContext: LanguageServiceDocumentContext;
	private globalSnapshotManager: GlobalSnapshotManager = new GlobalSnapshotManager();

	constructor(
		private readonly docManager: DocumentManager,
		private readonly workspaceUris: string[],
		private readonly configManager: ConfigManager
	) {
		this.docContext = {
			createDocument: this.createDocument,
			globalSnapshotManager: this.globalSnapshotManager,
		};

		const handleDocumentChange = (document: AstroDocument) => {
			this.getSnapshot(document);
		};

		docManager.on(
			'documentChange',
			debounceSameArg(handleDocumentChange, (newDoc, prevDoc) => newDoc.uri === prevDoc?.uri, 1000)
		);
		docManager.on('documentOpen', handleDocumentChange);
	}

	/**
	 * Create an AstroDocument (only for astro files)
	 */
	private createDocument = (fileName: string, content: string) => {
		const uri = pathToUrl(fileName);
		const document = this.docManager.openDocument({
			text: content,
			uri,
		});
		this.docManager.lockDocument(uri);
		return document;
	};

	async getSnapshot(document: AstroDocument): Promise<DocumentSnapshot>;
	async getSnapshot(pathOrDoc: string | AstroDocument): Promise<DocumentSnapshot>;
	async getSnapshot(pathOrDoc: string | AstroDocument) {
		const filePath = typeof pathOrDoc === 'string' ? pathOrDoc : pathOrDoc.getFilePath() || '';
		const tsService = await this.getTypeScriptLanguageService(filePath);
		return tsService.updateSnapshot(pathOrDoc);
	}

	async getLSAndTSDoc(document: AstroDocument): Promise<{
		tsDoc: DocumentSnapshot;
		lang: ts.LanguageService;
	}> {
		const lang = await this.getLSForPath(document.getFilePath() || '');
		const tsDoc = await this.getSnapshot(document);

		return { tsDoc, lang };
	}

	async getLSForPath(path: string) {
		return (await this.getTypeScriptLanguageService(path)).getService();
	}

	async getTypeScriptLanguageService(filePath: string): Promise<LanguageServiceContainer> {
		return getLanguageService(filePath, this.workspaceUris, this.docContext);
	}
}
