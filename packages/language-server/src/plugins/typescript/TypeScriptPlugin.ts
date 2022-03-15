import { CancellationToken, Diagnostic, Hover, Position } from 'vscode-languageserver';
import { ConfigManager, LSTypescriptConfig } from '../../core/config';
import { AstroDocument, DocumentManager } from '../../core/documents';
import { Plugin } from '../interfaces';
import { DiagnosticsProviderImpl } from './features/DiagnosticsProvider';
import { HoverProviderImpl } from './features/HoverProvider';
import { LanguageServiceManager } from './LanguageServiceManager';

export class TypeScriptPlugin implements Plugin {
	__name = 'typescript';

	private configManager: ConfigManager;
	private readonly languageServiceManager: LanguageServiceManager;

	private readonly diagnosticsProvider: DiagnosticsProviderImpl;
	private readonly hoverProvider: HoverProviderImpl;

	constructor(docManager: DocumentManager, configManager: ConfigManager, workspaceUris: string[]) {
		this.configManager = configManager;
		this.languageServiceManager = new LanguageServiceManager(docManager, workspaceUris, configManager);

		this.diagnosticsProvider = new DiagnosticsProviderImpl(this.languageServiceManager);
		this.hoverProvider = new HoverProviderImpl(this.languageServiceManager);
	}

	async doHover(document: AstroDocument, position: Position): Promise<Hover | null> {
		return this.hoverProvider.doHover(document, position);
	}

	async getDiagnostics(document: AstroDocument, cancellationToken?: CancellationToken): Promise<Diagnostic[]> {
		if (!this.featureEnabled('diagnostics')) {
			return [];
		}

		return this.diagnosticsProvider.getDiagnostics(document, cancellationToken);
	}

	private featureEnabled(feature: keyof LSTypescriptConfig) {
		return (
			this.configManager.enabled('typescript.enabled') && this.configManager.enabled(`typescript.${feature}.enabled`)
		);
	}
}
