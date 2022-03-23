import { NavigationTree } from 'typescript';
import { SymbolInformation, Range, SymbolKind } from 'vscode-languageserver-types';
import { AstroDocument, mapSymbolInformationToOriginal } from '../../../core/documents';
import { DocumentSymbolsProvider } from '../../interfaces';
import { LanguageServiceManager } from '../LanguageServiceManager';
import { SnapshotFragment } from '../snapshots/DocumentSnapshot';
import { symbolKindFromString } from '../utils';

export class DocumentSymbolsProviderImpl implements DocumentSymbolsProvider {
	constructor(private languageServiceManager: LanguageServiceManager) {}

	async getDocumentSymbols(document: AstroDocument): Promise<SymbolInformation[]> {
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
		const fragment = await tsDoc.createFragment();

		const navTree = lang.getNavigationTree(tsDoc.filePath);

		const symbols: SymbolInformation[] = [];
		this.collectSymbols(navTree, fragment, undefined, (symbol) => symbols.push(symbol));

		const result: SymbolInformation[] = [];

		// Add a "frontmatter" namespace for the frontmatter if we have a closed one
		if (document.astroMeta.frontmatter.state === 'closed') {
			result.push(
				SymbolInformation.create(
					'Frontmatter',
					SymbolKind.Namespace,
					Range.create(
						document.positionAt(document.astroMeta.frontmatter.startOffset as number),
						document.positionAt(document.astroMeta.frontmatter.endOffset as number)
					)
				)
			);
		}

		// Add a template namespace
		result.push(
			SymbolInformation.create(
				'Template',
				SymbolKind.Namespace,
				Range.create(
					document.positionAt(document.astroMeta.content.firstNonWhitespaceOffset ?? 0),
					document.positionAt(document.getTextLength())
				)
			)
		);

		for (let symbol of symbols.splice(1)) {
			symbol = mapSymbolInformationToOriginal(fragment, symbol);

			if (document.offsetAt(symbol.location.range.end) >= (document.astroMeta.content.firstNonWhitespaceOffset ?? 0)) {
				symbol.containerName = 'Template';

				// For some reason, it seems like TypeScript thinks that the "class" attribute is a real class, weird
				if (symbol.kind === SymbolKind.Class && symbol.name === '<class>') {
					const node = document.html.findNodeAt(document.offsetAt(symbol.location.range.start));
					if (node.attributes?.class) {
						continue;
					}
				}
			}

			// Remove the default function detected in our TSX output
			if (symbol.kind === SymbolKind.Function && symbol.name == 'default') {
				continue;
			}

			result.push(symbol);
		}

		return result;
	}

	private collectSymbols(
		tree: NavigationTree,
		fragment: SnapshotFragment,
		container: string | undefined,
		cb: (symbol: SymbolInformation) => void
	) {
		const start = tree.spans[0];
		const end = tree.spans[tree.spans.length - 1];
		if (start && end) {
			cb(
				SymbolInformation.create(
					tree.text,
					symbolKindFromString(tree.kind),
					Range.create(fragment.positionAt(start.start), fragment.positionAt(end.start + end.length)),
					fragment.getURL(),
					container
				)
			);
		}
		if (tree.childItems) {
			for (const child of tree.childItems) {
				this.collectSymbols(child, fragment, tree.text, cb);
			}
		}
	}
}
