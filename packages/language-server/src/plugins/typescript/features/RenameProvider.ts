import { Position, Range, WorkspaceEdit } from 'vscode-languageserver-types';
import { AstroDocument, mapRangeToOriginal } from '../../../core/documents';
import { pathToUrl } from '../../../utils';
import type { RenameProvider } from '../../interfaces';
import type { LanguageServiceManager } from '../LanguageServiceManager';
import { AstroSnapshot } from '../snapshots/DocumentSnapshot';
import { convertRange } from '../utils';
import { SnapshotMap } from './utils';

export class RenameProviderImpl implements RenameProvider {
	private ts: typeof import('typescript/lib/tsserverlibrary');

	constructor(private languageServiceManager: LanguageServiceManager) {
		this.ts = languageServiceManager.docContext.ts;
	}

	async prepareRename(document: AstroDocument, position: Position): Promise<Range | null> {
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
		const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));

		// If our TSX isn't valid, we can't rename safely, so let's abort
		if ((tsDoc as AstroSnapshot).isInErrorState) {
			return null;
		}

		const renameInfo = lang.getRenameInfo(tsDoc.filePath, offset, {});

		if (!renameInfo.canRename) {
			return null;
		}

		return mapRangeToOriginal(tsDoc, convertRange(tsDoc, renameInfo.triggerSpan));
	}

	async rename(document: AstroDocument, position: Position, newName: string): Promise<WorkspaceEdit | null> {
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);

		const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));

		let renames = lang.findRenameLocations(tsDoc.filePath, offset, false, false, true);
		if (!renames) {
			return null;
		}

		const docs = new SnapshotMap(this.languageServiceManager);
		docs.set(tsDoc.filePath, tsDoc);

		const mappedRenames = await Promise.all(
			renames.map(async (rename) => {
				const snapshot = await docs.retrieve(rename.fileName);

				return {
					...rename,
					range: mapRangeToOriginal(snapshot, convertRange(snapshot, rename.textSpan)),
					newName,
				};
			})
		);

		return mappedRenames.reduce(
			(acc, loc) => {
				const uri = pathToUrl(loc.fileName);
				if (!acc.changes[uri]) {
					acc.changes[uri] = [];
				}

				acc.changes[uri].push({
					newText: (loc.prefixText || '') + (loc.newName || newName) + (loc.suffixText || ''),
					range: loc.range,
				});
				return acc;
			},
			<Required<Pick<WorkspaceEdit, 'changes'>>>{ changes: {} }
		);
	}
}
