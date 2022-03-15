import {
	CancellationToken,
	CompletionContext,
	Diagnostic,
	Hover,
	Position,
	SignatureHelp,
	SignatureHelpContext,
} from 'vscode-languageserver';
import { ConfigManager, LSTypescriptConfig } from '../../core/config';
import { AstroDocument, DocumentManager } from '../../core/documents';
import { AppCompletionList, Plugin } from '../interfaces';
import { CompletionEntryWithIdentifer, CompletionsProviderImpl } from './features/CompletionsProvider';
import { DiagnosticsProviderImpl } from './features/DiagnosticsProvider';
import { HoverProviderImpl } from './features/HoverProvider';
import { SignatureHelpProviderImpl } from './features/SignatureHelpProvider';
import { LanguageServiceManager } from './LanguageServiceManager';

export class TypeScriptPlugin implements Plugin {
	__name = 'typescript';

	private configManager: ConfigManager;
	private readonly languageServiceManager: LanguageServiceManager;

	private readonly completionProvider: CompletionsProviderImpl;
	private readonly hoverProvider: HoverProviderImpl;
	private readonly signatureHelpProvider: SignatureHelpProviderImpl;
	private readonly diagnosticsProvider: DiagnosticsProviderImpl;

	constructor(docManager: DocumentManager, configManager: ConfigManager, workspaceUris: string[]) {
		this.configManager = configManager;
		this.languageServiceManager = new LanguageServiceManager(docManager, workspaceUris, configManager);

		this.completionProvider = new CompletionsProviderImpl(this.languageServiceManager);
		this.hoverProvider = new HoverProviderImpl(this.languageServiceManager);
		this.signatureHelpProvider = new SignatureHelpProviderImpl(this.languageServiceManager);
		this.diagnosticsProvider = new DiagnosticsProviderImpl(this.languageServiceManager);
	}

	async doHover(document: AstroDocument, position: Position): Promise<Hover | null> {
		return this.hoverProvider.doHover(document, position);
	}

	async getCompletions(
		document: AstroDocument,
		position: Position,
		completionContext?: CompletionContext
	): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null> {
		const completions = await this.completionProvider.getCompletions(document, position, completionContext);

		return completions;
	}

	async getDiagnostics(document: AstroDocument, cancellationToken?: CancellationToken): Promise<Diagnostic[]> {
		if (!this.featureEnabled('diagnostics')) {
			return [];
		}

		return this.diagnosticsProvider.getDiagnostics(document, cancellationToken);
	}

	async getSignatureHelp(
		document: AstroDocument,
		position: Position,
		context: SignatureHelpContext | undefined,
		cancellationToken?: CancellationToken
	): Promise<SignatureHelp | null> {
		return this.signatureHelpProvider.getSignatureHelp(document, position, context, cancellationToken);
	}

	private featureEnabled(feature: keyof LSTypescriptConfig) {
		return (
			this.configManager.enabled('typescript.enabled') && this.configManager.enabled(`typescript.${feature}.enabled`)
		);
	}
}
