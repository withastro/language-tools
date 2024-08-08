import { yaml2ts } from '@astrojs/yaml2ts';
import {
	type CodeMapping,
	type LanguagePlugin,
	type VirtualCode,
	forEachEmbeddedCode,
} from '@volar/language-core';
import type ts from 'typescript';

export type CollectionConfig = {
	folder: string;
	config: {
		collections: {
			hasSchema: boolean;
			name: string;
		}[];
		entries: Record<string, string>;
	};
};

function getCollectionName(collectionConfigs: CollectionConfig[], fsPath: string) {
	// console.log('===== ASTRO TS PLUGIN =====', fsPath);
	for (const collection of collectionConfigs) {
		if (collection.config.entries[fsPath]) {
			return collection.config.entries[fsPath];
		}
	}
}

export function getFrontmatterLanguagePlugin(
	collectionConfigs: CollectionConfig[],
): LanguagePlugin<string, FrontmatterHolder> {
	return {
		getLanguageId(scriptId) {
			if (scriptId.endsWith('.md') || scriptId.endsWith('.mdx') || scriptId.endsWith('.mdoc')) {
				return 'frontmatter';
			}
		},
		createVirtualCode(scriptId, languageId, snapshot) {
			if (languageId === 'frontmatter') {
				const fileName = scriptId.replace(/\\/g, '/');
				return new FrontmatterHolder(
					fileName,
					snapshot,
					getCollectionName(collectionConfigs, fileName),
				);
			}
		},
		updateVirtualCode(scriptId, virtualCode, newSnapshot) {
			return virtualCode.updateSnapshot(newSnapshot);
		},
		typescript: {
			extraFileExtensions: [
				{ extension: 'md', isMixedContent: true, scriptKind: 7 },
				{ extension: 'mdx', isMixedContent: true, scriptKind: 7 },
				{ extension: 'mdoc', isMixedContent: true, scriptKind: 7 },
			],
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
	languageId = 'frontmatter';
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

		if (this.hasFrontmatter) {
			const yaml2tsResult = yaml2ts(frontmatter, this.snapshot, this.collection);
			this.embeddedCodes.push(yaml2tsResult.virtualCode);
		}

		return this;
	}
}
