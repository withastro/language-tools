import type { LanguageServicePlugin } from '@volar/language-service';
import { Range, Diagnostic, DiagnosticSeverity, MarkupContent } from '@volar/language-server';
import { create as createYAMLService } from 'volar-service-yaml';
import { URI, Utils } from 'vscode-uri';
import { CollectionConfig, FrontmatterHolder } from '../core/frontmatterHolders.js';

export const create = (collectionConfigs: CollectionConfig[]): LanguageServicePlugin => {
	const yamlPlugin = createYAMLService({
		getLanguageSettings(context) {
			if (!context.env.fs) {
				return {};
			}

			const schemas = collectionConfigs.flatMap((workspaceCollectionConfig) => {
				return workspaceCollectionConfig.config.collections.flatMap((collection) => {
					return {
						priority: 3,
						fileMatch: [
							`volar-embedded-content://yaml_frontmatter_${collection.name}/**/*.md`,
							`volar-embedded-content://yaml_frontmatter_${collection.name}/**/*.mdx`,
							`volar-embedded-content://yaml_frontmatter_${collection.name}/**/*.mdoc`,
						],
						uri: Utils.joinPath(
							workspaceCollectionConfig.folder,
							'.astro/collections',
							`${collection.name}.schema.json`
						).toString(),
					};
				});
			});

			return {
				completion: true,
				format: false,
				hover: true,
				validate: true,
				customTags: [],
				yamlVersion: '1.2',
				isKubernetes: false,
				parentSkeletonSelectedFirst: false,
				disableDefaultProperties: false,
				schemas: schemas,
			};
		},
	});

	return {
		...yamlPlugin,
		create(context) {
			const yamlPluginInstance = yamlPlugin.create(context);

			return {
				...yamlPluginInstance,
				// Disable codelenses, we'll provide our own
				async provideCodeLenses(document, token) {
					return null;
				},
				async provideDiagnostics(document, token) {
					const originalDiagnostics = await yamlPluginInstance.provideDiagnostics!(document, token);
					if (!originalDiagnostics) {
						return null;
					}

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const root = sourceScript?.generated?.root;
					if (!(root instanceof FrontmatterHolder)) return undefined;

					// If we don't have a frontmatter, but there are errors, it probably means a frontmatter was required
					if (!root.hasFrontmatter && originalDiagnostics.length > 0) {
						return [
							Diagnostic.create(
								Range.create(0, 0, 0, 0),
								'Frontmatter is required for this file.',
								DiagnosticSeverity.Error
							),
						];
					}

					return originalDiagnostics.map((diagnostic) => {
						// The YAML schema source is not useful to users, since it's generated. Also, it's quite long.
						if (diagnostic.source?.startsWith('yaml-schema:')) {
							diagnostic.source = 'astro';

							// In Astro, schema errors are always fatal
							diagnostic.severity = DiagnosticSeverity.Error;

							// Map missing properties to the entire frontmatte
							if (diagnostic.message.startsWith('Missing property')) {
								diagnostic.range = Range.create(
									{ line: 0, character: 0 },
									document.positionAt(document.getText().length)
								);
							}
						}

						return diagnostic;
					});
				},
				async provideHover(document, position, token) {
					const originalHover = await yamlPluginInstance.provideHover!(document, position, token);
					if (!originalHover) {
						return null;
					}

					if (MarkupContent.is(originalHover.contents)) {
						// Remove last line that contains the source schema, it's not useful to users since they're generated
						originalHover.contents.value = originalHover.contents.value
							.replace(/\nSource:.*$/, '')
							.trim();
					}

					return originalHover;
				},
			};
		},
	};
};