import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, Range, WorkspaceEdit } from 'vscode-languageserver-types';
import { AstroDocument } from '../../../core/documents';
import type { RenameProvider, Resolvable } from '../../interfaces';
import type { LanguageServiceManager } from '../LanguageServiceManager';
import { convertToLocationRange, ensureRealFilePath } from '../utils';

export class RenameProviderImpl implements RenameProvider {
	private ts: typeof import('typescript/lib/tsserverlibrary');

	constructor(private languageServiceManager: LanguageServiceManager) {
		this.ts = languageServiceManager.docContext.ts;
	}

	async rename(document: AstroDocument, position: Position, newName: string): Promise<WorkspaceEdit | null> {
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);

		const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));

		let renames = lang.findRenameLocations(tsDoc.filePath, offset, false, false, true);
		if (!renames) {
			return null;
		}

		let edit = {
			changes: {},
		} as WorkspaceEdit;

		renames.forEach((rename) => {
			const filePath = ensureRealFilePath(rename.fileName);
			if (!(filePath in edit.changes!)) {
				edit.changes![filePath] = [];
			}

			edit.changes![filePath].push({
				newText: newName,
				range: convertToLocationRange(tsDoc, rename.textSpan),
			});
		});

		return edit;
	}

	prepareRename(document: TextDocument, position: Position): Resolvable<Range | null> {
		return null;
	}
}
