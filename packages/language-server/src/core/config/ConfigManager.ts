import { get, merge } from 'lodash';
import { VSCodeEmmetConfig } from '@vscode/emmet-helper';
import { LSConfig, LSCSSConfig, LSHTMLConfig, LSTypescriptConfig } from './interfaces';
import { Connection, DidChangeConfigurationParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FormatCodeSettings, TsConfigSourceFile, UserPreferences } from 'typescript';

const defaultLSConfig: LSConfig = {
	typescript: {
		enabled: true,
		diagnostics: { enabled: true },
		hover: { enabled: true },
		completions: { enabled: true },
		definitions: { enabled: true },
		documentSymbols: { enabled: true },
		codeActions: { enabled: true },
		rename: { enabled: true },
		signatureHelp: { enabled: true },
		semanticTokens: { enabled: true },
	},
	css: {
		enabled: true,
		hover: { enabled: true },
		completions: { enabled: true, emmet: true },
		documentColors: { enabled: true },
		documentSymbols: { enabled: true },
	},
	html: {
		enabled: true,
		hover: { enabled: true },
		completions: { enabled: true, emmet: true },
		tagComplete: { enabled: true },
		documentSymbols: { enabled: true },
	},
};

type DeepPartial<T> = T extends Record<string, unknown>
	? {
			[P in keyof T]?: DeepPartial<T[P]>;
	  }
	: T;

/**
 * Manager class to facilitate accessing and updating the user's config
 * Not to be confused with other kind of configurations (such as the Astro project configuration and the TypeScript/Javascript one)
 * For more info on this, see the [internal docs](../../../../../docs/internal/language-server/config.md)
 */
export class ConfigManager {
	private config = defaultLSConfig;
	private documentSettings: Record<string, Record<string, Promise<any>>> = {};

	private isTrusted = true;

	private connection: Connection;

	constructor(connection: Connection) {
		this.connection = connection;
	}

	updateConfig() {
		// Reset all cached document settings
		this.documentSettings = {};
	}

	removeDocument(scopeUri: string) {
		delete this.documentSettings[scopeUri];
	}

	async getConfig<T>(section: string, scopeUri: string): Promise<Awaited<T>> {
		if (!this.documentSettings[scopeUri]) {
			this.documentSettings[scopeUri] = {};
		}

		if (!this.documentSettings[scopeUri][section]) {
			this.documentSettings[scopeUri][section] = await this.connection.workspace.getConfiguration({
				scopeUri,
				section,
			});
		}

		return this.documentSettings[scopeUri][section];
	}

	async getEmmetConfig(document: TextDocument): Promise<VSCodeEmmetConfig> {
		const emmetConfig = (await this.getConfig<VSCodeEmmetConfig>('emmet', document.uri)) ?? {};

		return emmetConfig;
	}

	async getTSFormatConfig(document: TextDocument): Promise<FormatCodeSettings> {
		const formatConfig = (await this.getConfig<FormatCodeSettings>('typescript.format', document.uri)) ?? {};

		return formatConfig;
	}

	async getTSPreferences(document: TextDocument): Promise<UserPreferences> {
		const config = (await this.getConfig<any>('typescript', document.uri)) ?? {};
		const preferences = config['preferences'];

		return {
			quotePreference: getQuoteStylePreference(preferences),
			importModuleSpecifierPreference: getImportModuleSpecifierPreference(preferences),
			importModuleSpecifierEnding: getImportModuleSpecifierEndingPreference(preferences),
			allowTextChangesInNewFiles: document.uri.startsWith('file://'),
			providePrefixAndSuffixTextForRename:
				(preferences.renameShorthandProperties ?? true) === false ? false : preferences.useAliasesForRenames ?? true,
			includeAutomaticOptionalChainCompletions: config.suggest?.includeAutomaticOptionalChainCompletions ?? true,
			includeCompletionsForImportStatements: config.suggest?.includeCompletionsForImportStatements ?? true,
			includeCompletionsWithSnippetText: config.suggest?.includeCompletionsWithSnippetText ?? true,
			includeCompletionsForModuleExports: config.suggest?.autoImports ?? true,
			allowIncompleteCompletions: true,
		};
	}

	/**
	 * Whether or not specified setting is enabled
	 * @param key a string which is a path. Example: 'astro.diagnostics.enabled'.
	 */
	enabled(key: string): boolean {
		return !!this.get(key);
	}

	async isEnabled(
		document: TextDocument,
		plugin: keyof LSConfig,
		feature?: keyof LSTypescriptConfig | keyof LSCSSConfig | keyof LSHTMLConfig
	) {
		const config = await this.getConfig<any>('astro', document.uri);

		return feature ? config[plugin][feature]['enabled'] : config[plugin]['enabled'];
	}

	/**
	 * Get a specific setting value
	 * @param key a string which is a path. Example: 'astro.diagnostics.enable'.
	 */
	get<T>(key: string): T {
		return get(this.config, key);
	}
}

function getQuoteStylePreference(config: any) {
	switch (config.quoteStyle as string) {
		case 'single':
			return 'single';
		case 'double':
			return 'double';
		default:
			return 'auto';
	}
}

function getImportModuleSpecifierPreference(config: any) {
	switch (config.importModuleSpecifier as string) {
		case 'project-relative':
			return 'project-relative';
		case 'relative':
			return 'relative';
		case 'non-relative':
			return 'non-relative';
		default:
			return undefined;
	}
}

function getImportModuleSpecifierEndingPreference(config: any) {
	switch (config.importModuleSpecifierEnding as string) {
		case 'minimal':
			return 'minimal';
		case 'index':
			return 'index';
		case 'js':
			return 'js';
		default:
			return 'auto';
	}
}
