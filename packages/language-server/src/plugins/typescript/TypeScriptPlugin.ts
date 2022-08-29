import {
	CancellationToken,
	CodeAction,
	CodeActionContext,
	CompletionContext,
	DefinitionLink,
	Location,
	Diagnostic,
	FileChangeType,
	FoldingRange,
	Hover,
	InlayHint,
	Position,
	Range,
	SemanticTokens,
	SignatureHelp,
	SignatureHelpContext,
	SymbolInformation,
	TextDocumentContentChangeEvent,
	WorkspaceEdit,
} from 'vscode-languageserver';
import type { ConfigManager, LSTypescriptConfig } from '../../core/config';
import type { AstroDocument } from '../../core/documents';
import type { AppCompletionItem, AppCompletionList, OnWatchFileChangesParam, Plugin } from '../interfaces';
import { CompletionItemData, CompletionsProviderImpl } from './features/CompletionsProvider';
import { DiagnosticsProviderImpl } from './features/DiagnosticsProvider';
import { HoverProviderImpl } from './features/HoverProvider';
import { SignatureHelpProviderImpl } from './features/SignatureHelpProvider';
import type { LanguageServiceManager } from './LanguageServiceManager';
import { convertToLocationRange, ensureRealFilePath, getScriptKindFromFileName, toVirtualAstroFilePath } from './utils';
import { DocumentSymbolsProviderImpl } from './features/DocumentSymbolsProvider';
import { SemanticTokensProviderImpl } from './features/SemanticTokenProvider';
import { FoldingRangesProviderImpl } from './features/FoldingRangesProvider';
import { CodeActionsProviderImpl } from './features/CodeActionsProvider';
import { DefinitionsProviderImpl } from './features/DefinitionsProvider';
import { InlayHintsProviderImpl } from './features/InlayHintsProvider';
import astro2tsx, { Astro2TSXResult } from './astro2tsx';
import { classNameFromFilename } from './snapshots/utils';
import { TypeDefinitionsProviderImpl } from './features/TypeDefinitionsProvider';

export class TypeScriptPlugin implements Plugin {
	__name = 'typescript';

	private configManager: ConfigManager;
	private readonly languageServiceManager: LanguageServiceManager;

	private readonly codeActionsProvider: CodeActionsProviderImpl;
	private readonly completionProvider: CompletionsProviderImpl;
	private readonly hoverProvider: HoverProviderImpl;
	private readonly definitionsProvider: DefinitionsProviderImpl;
	private readonly typeDefinitionsProvider: TypeDefinitionsProviderImpl;
	private readonly signatureHelpProvider: SignatureHelpProviderImpl;
	private readonly diagnosticsProvider: DiagnosticsProviderImpl;
	private readonly documentSymbolsProvider: DocumentSymbolsProviderImpl;
	private readonly inlayHintsProvider: InlayHintsProviderImpl;
	private readonly semanticTokensProvider: SemanticTokensProviderImpl;
	private readonly foldingRangesProvider: FoldingRangesProviderImpl;

	private readonly ts: typeof import('typescript/lib/tsserverlibrary');

	constructor(
		configManager: ConfigManager,
		languageServiceManager: LanguageServiceManager,
		ts: typeof import('typescript/lib/tsserverlibrary')
	) {
		this.configManager = configManager;
		this.languageServiceManager = languageServiceManager;
		this.ts = ts;

		this.codeActionsProvider = new CodeActionsProviderImpl(this.languageServiceManager, this.configManager, ts);
		this.completionProvider = new CompletionsProviderImpl(this.languageServiceManager, this.configManager, ts);
		this.hoverProvider = new HoverProviderImpl(this.languageServiceManager, ts);
		this.definitionsProvider = new DefinitionsProviderImpl(this.languageServiceManager);
		this.typeDefinitionsProvider = new TypeDefinitionsProviderImpl(this.languageServiceManager);
		this.signatureHelpProvider = new SignatureHelpProviderImpl(this.languageServiceManager, ts);
		this.diagnosticsProvider = new DiagnosticsProviderImpl(this.languageServiceManager, ts);
		this.documentSymbolsProvider = new DocumentSymbolsProviderImpl(this.languageServiceManager, ts);
		this.semanticTokensProvider = new SemanticTokensProviderImpl(this.languageServiceManager, ts);
		this.inlayHintsProvider = new InlayHintsProviderImpl(this.languageServiceManager, this.configManager, ts);
		this.foldingRangesProvider = new FoldingRangesProviderImpl(this.languageServiceManager, ts);
	}

	async doHover(document: AstroDocument, position: Position): Promise<Hover | null> {
		if (!(await this.featureEnabled(document, 'hover'))) {
			return null;
		}

		return this.hoverProvider.doHover(document, position);
	}

	async rename(document: AstroDocument, position: Position, newName: string): Promise<WorkspaceEdit | null> {
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
		const fragment = await tsDoc.createFragment();

		const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));

		let renames = lang.findRenameLocations(toVirtualAstroFilePath(tsDoc.filePath), offset, false, false, true);
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
				range: convertToLocationRange(fragment, rename.textSpan),
			});
		});

		return edit;
	}

	async getFoldingRanges(document: AstroDocument): Promise<FoldingRange[] | null> {
		return this.foldingRangesProvider.getFoldingRanges(document);
	}

	async getSemanticTokens(
		document: AstroDocument,
		range?: Range,
		cancellationToken?: CancellationToken
	): Promise<SemanticTokens | null> {
		if (!(await this.featureEnabled(document, 'semanticTokens'))) {
			return null;
		}

		return this.semanticTokensProvider.getSemanticTokens(document, range, cancellationToken);
	}

	async getDocumentSymbols(document: AstroDocument): Promise<SymbolInformation[]> {
		if (!(await this.featureEnabled(document, 'documentSymbols'))) {
			return [];
		}

		const symbols = await this.documentSymbolsProvider.getDocumentSymbols(document);

		return symbols;
	}

	async getCodeActions(
		document: AstroDocument,
		range: Range,
		context: CodeActionContext,
		cancellationToken?: CancellationToken
	): Promise<CodeAction[]> {
		if (!(await this.featureEnabled(document, 'codeActions'))) {
			return [];
		}

		return this.codeActionsProvider.getCodeActions(document, range, context, cancellationToken);
	}

	async getCompletions(
		document: AstroDocument,
		position: Position,
		completionContext?: CompletionContext,
		cancellationToken?: CancellationToken
	): Promise<AppCompletionList<CompletionItemData> | null> {
		if (!(await this.featureEnabled(document, 'completions'))) {
			return null;
		}

		const completions = await this.completionProvider.getCompletions(
			document,
			position,
			completionContext,
			cancellationToken
		);

		return completions;
	}

	async resolveCompletion(
		document: AstroDocument,
		completionItem: AppCompletionItem<CompletionItemData>,
		cancellationToken?: CancellationToken
	): Promise<AppCompletionItem<CompletionItemData>> {
		return this.completionProvider.resolveCompletion(document, completionItem, cancellationToken);
	}

	async getInlayHints(document: AstroDocument, range: Range): Promise<InlayHint[]> {
		return this.inlayHintsProvider.getInlayHints(document, range);
	}

	async getDefinitions(document: AstroDocument, position: Position): Promise<DefinitionLink[]> {
		return this.definitionsProvider.getDefinitions(document, position);
	}

	async getTypeDefinition(document: AstroDocument, position: Position): Promise<Location[] | null> {
		return this.typeDefinitionsProvider.getTypeDefinitions(document, position);
	}

	async getDiagnostics(document: AstroDocument, cancellationToken?: CancellationToken): Promise<Diagnostic[]> {
		if (!(await this.featureEnabled(document, 'diagnostics'))) {
			return [];
		}

		return this.diagnosticsProvider.getDiagnostics(document, cancellationToken);
	}

	async onWatchFileChanges(onWatchFileChangesParas: OnWatchFileChangesParam[]): Promise<void> {
		let doneUpdateProjectFiles = false;

		for (const { fileName, changeType } of onWatchFileChangesParas) {
			const scriptKind = getScriptKindFromFileName(fileName, this.ts);

			if (scriptKind === this.ts.ScriptKind.Unknown) {
				continue;
			}

			if (changeType === FileChangeType.Created && !doneUpdateProjectFiles) {
				doneUpdateProjectFiles = true;
				await this.languageServiceManager.updateProjectFiles();
			} else if (changeType === FileChangeType.Deleted) {
				await this.languageServiceManager.deleteSnapshot(fileName);
			} else {
				await this.languageServiceManager.updateExistingNonAstroFile(fileName);
			}
		}
	}

	async updateNonAstroFile(fileName: string, changes: TextDocumentContentChangeEvent[]): Promise<void> {
		await this.languageServiceManager.updateExistingNonAstroFile(fileName, changes);
	}

	async getSignatureHelp(
		document: AstroDocument,
		position: Position,
		context: SignatureHelpContext | undefined,
		cancellationToken?: CancellationToken
	): Promise<SignatureHelp | null> {
		return this.signatureHelpProvider.getSignatureHelp(document, position, context, cancellationToken);
	}

	getTSXForDocument(document: AstroDocument): Astro2TSXResult {
		return astro2tsx(document.getText(), classNameFromFilename(document.getURL()));
	}

	private async featureEnabled(document: AstroDocument, feature: keyof LSTypescriptConfig) {
		return (
			(await this.configManager.isEnabled(document, 'typescript')) &&
			(await this.configManager.isEnabled(document, 'typescript', feature))
		);
	}
}
