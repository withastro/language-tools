import type {
	CodeInformation,
	Language,
	VirtualFile,
} from '@volar/language-core';
import type { Mapping } from '@volar/source-map';
import type ts from 'typescript/lib/tsserverlibrary';
import { framework2tsx } from './utils.js';

export function getVueLanguageModule(): Language<VueFile> {
	return {
		createVirtualFile(id, languageId, snapshot) {
			if (languageId === 'vue') {
				return new VueFile(id, snapshot);
			}
		},
		updateVirtualFile(vueFile, snapshot) {
			vueFile.update(snapshot);
		},
	};
}

class VueFile implements VirtualFile {
	id: string;
	languageId = 'vue';
	mappings!: Mapping<CodeInformation>[];
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
				'vue'
			)
		);
	}
}
