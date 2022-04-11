import { workspace } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';

export function getInitOptions(env: 'node' | 'browser'): LanguageClientOptions {
	return {
		documentSelector: [{ scheme: 'file', language: 'astro' }],
		synchronize: {
			configurationSection: ['astro', 'javascript', 'typescript', 'prettier'],
			fileEvents: workspace.createFileSystemWatcher('{**/*.js,**/*.ts}', false, false, false),
		},
		initializationOptions: {
			configuration: {
				astro: workspace.getConfiguration('astro'),
				prettier: workspace.getConfiguration('prettier'),
				emmet: workspace.getConfiguration('emmet'),
				typescript: workspace.getConfiguration('typescript'),
				javascript: workspace.getConfiguration('javascript'),
			},
			environment: env,
			dontFilterIncompleteCompletions: true, // VSCode filters client side and is smarter at it than us
			isTrusted: workspace.isTrusted,
		},
	};
}
