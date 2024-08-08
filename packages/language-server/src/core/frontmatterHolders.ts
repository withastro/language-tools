import { yaml2ts } from '@astrojs/yaml2ts';
import {
	type CodeMapping,
	type LanguagePlugin,
	type VirtualCode,
	forEachEmbeddedCode,
} from '@volar/language-core';
import type ts from 'typescript';
import type { URI } from 'vscode-uri';

export const SUPPORTED_FRONTMATTER_EXTENSIONS = { md: 'markdown', mdx: 'mdx', mdoc: 'mdoc' };
export const SUPPORTED_FRONTMATTER_EXTENSIONS_KEYS = Object.keys(SUPPORTED_FRONTMATTER_EXTENSIONS);
const SUPPORTED_FRONTMATTER_EXTENSIONS_VALUES = Object.values(SUPPORTED_FRONTMATTER_EXTENSIONS);

export type CollectionConfig = {
	folder: URI;
	config: {
		collections: {
			hasSchema: boolean;
			name: string;
		}[];
		entries: Record<string, string>;
	};
};

function getCollectionName(collectionConfigs: CollectionConfig[], fileURI: string) {
	for (const collection of collectionConfigs) {
		if (collection.config.entries[fileURI]) {
			return collection.config.entries[fileURI];
		}
	}
}

export function getFrontmatterLanguagePlugin(
	collectionConfigs: CollectionConfig[],
): LanguagePlugin<URI, FrontmatterHolder> {
	return {
		getLanguageId(scriptId) {
			const fileType = SUPPORTED_FRONTMATTER_EXTENSIONS_KEYS.find((ext) =>
				scriptId.path.endsWith(`.${ext}`),
			);

			if (fileType) {
				return SUPPORTED_FRONTMATTER_EXTENSIONS[
					fileType as keyof typeof SUPPORTED_FRONTMATTER_EXTENSIONS
				];
			}
		},
		createVirtualCode(scriptId, languageId, snapshot) {
			if (SUPPORTED_FRONTMATTER_EXTENSIONS_VALUES.includes(languageId)) {
				return new FrontmatterHolder(
					scriptId.fsPath.replace(/\\/g, '/'),
					languageId,
					snapshot,
					getCollectionName(
						collectionConfigs,
						decodeURIComponent(scriptId.toString()).toLowerCase(),
					),
				);
			}
		},
		updateVirtualCode(_, virtualCode, newSnapshot) {
			return virtualCode.updateSnapshot(newSnapshot);
		},
		typescript: {
			extraFileExtensions: SUPPORTED_FRONTMATTER_EXTENSIONS_KEYS.map((ext) => ({
				extension: ext,
				isMixedContent: true,
				scriptKind: 7,
			})),
			getServiceScript(astroCode) {
				for (const code of forEachEmbeddedCode(astroCode)) {
					if (code.id === 'frontmatter-ts') {
						return {
							code,
							extension: '.ts',
							scriptKind: 3 satisfies ts.ScriptKind.TS,
						};
					}
				}
				return undefined;
			},
		},
	};
}

export class FrontmatterHolder implements VirtualCode {
	id = 'frontmatter-holder';
	mappings!: CodeMapping[];
	embeddedCodes!: VirtualCode[];
	public hasFrontmatter = false;

	lastValidContent: {
		source: string;
		generated: string;
		mappings: CodeMapping[];
	} = {
		source: '',
		generated: '',
		mappings: [],
	};

	constructor(
		public fileName: string,
		public languageId: string,
		public snapshot: ts.IScriptSnapshot,
		public collection: string | undefined,
	) {
		this.updateSnapshot(snapshot);
	}

	updateSnapshot(snapshot: ts.IScriptSnapshot) {
		this.mappings = [
			{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [this.snapshot.getLength()],
				data: {
					verification: true,
					completion: true,
					semantic: true,
					navigation: true,
					structure: true,
					format: true,
				},
			},
		];

		this.embeddedCodes = [];
		this.snapshot = snapshot;

		if (!this.collection) {
			return this;
		}

		// TODO: More robust frontmatter detection
		this.hasFrontmatter = this.snapshot.getText(0, 10).startsWith('---');

		const frontmatter = this.hasFrontmatter
			? this.snapshot
					.getText(0, this.snapshot.getText(0, this.snapshot.getLength()).indexOf('---', 3) + 3)
					.replaceAll('---', '   ')
			: ''; // Generate an empty frontmatter so that we can map an error for a missing frontmatter

		this.embeddedCodes.push({
			id: `yaml_frontmatter_${this.collection}`,
			languageId: 'yaml',
			snapshot: {
				getText: (start, end) => frontmatter.substring(start, end),
				getLength: () => frontmatter.length,
				getChangeRange: () => undefined,
			},
			mappings: [
				{
					sourceOffsets: [0],
					generatedOffsets: [0],
					lengths: [frontmatter.length],
					data: {
						verification: true,
						completion: true,
						semantic: true,
						navigation: true,
						structure: true,
						format: false,
					},
				},
			],
		});

		if (this.hasFrontmatter) {
			const yaml2tsResult = yaml2ts(frontmatter, this.collection);
			this.embeddedCodes.push(yaml2tsResult.virtualCode);
		}

		return this;
	}
}
