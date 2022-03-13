import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic } from 'vscode-languageserver-types';
import { DiagnosticsProvider } from '../../interfaces';

export class DiagnosticProviderImpl implements DiagnosticsProvider {
	async getDiagnostics(document: TextDocument): Promise<Diagnostic[]> {
		return [];
	}
}
