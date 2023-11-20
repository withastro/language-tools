import {
	FileKind,
	CodeInformations,
	Language,
	VirtualFile,
} from '@volar/language-core';
import type { Mapping } from '@volar/source-map';
import type ts from 'typescript/lib/tsserverlibrary';
import { framework2tsx } from './utils.js';

export function getSvelteLanguageModule(): Language<SvelteFile> {
	return {
		createVirtualFile(id, languageId, snapshot) {
			if (languageId === 'svelte') {
				return new SvelteFile(id, snapshot);
			}
		},
		updateVirtualFile(svelteFile, snapshot) {
			svelteFile.update(snapshot);
		},
	};
}

class SvelteFile implements VirtualFile {
	kind = FileKind.TextFile;

	id: string;
	languageId = 'svelte';
	mappings!: Mapping<CodeInformations>[];
	embeddedFiles!: VirtualFile[];
	codegenStacks = [];

	constructor(
		public sourceFileId: string,
		public snapshot: ts.IScriptSnapshot
	) {
		this.id = sourceFileId;
		this.onSnapshotUpdated();
	}

	public update(newSnapshot: ts.IScriptSnapshot) {
		this.snapshot = newSnapshot;
		this.onSnapshotUpdated();
	}

	private onSnapshotUpdated() {
		this.mappings = [
			{
				sourceRange: [0, this.snapshot.getLength()],
				generatedRange: [0, this.snapshot.getLength()],
				data: {},
			},
		];

		this.embeddedFiles = [];
		this.embeddedFiles.push(
			framework2tsx(
				this.id,
				this.id,
				this.snapshot.getText(0, this.snapshot.getLength()),
				'svelte'
			)
		);
	}
}
