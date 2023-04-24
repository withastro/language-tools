import {
	FileCapabilities,
	FileKind,
	FileRangeCapabilities,
	LanguageModule,
	VirtualFile,
} from '@volar/language-core';
import type { Mapping } from '@volar/source-map';
import type ts from 'typescript/lib/tsserverlibrary';
import { framework2tsx } from './utils.js';

export function getSvelteLanguageModule(): LanguageModule<SvelteFile> {
	return {
		createFile(fileName, snapshot) {
			if (fileName.endsWith('.svelte')) {
				return new SvelteFile(fileName, snapshot);
			}
		},
		updateFile(svelteFile, snapshot) {
			svelteFile.update(snapshot);
		},
	};
}

class SvelteFile implements VirtualFile {
	kind = FileKind.TextFile;
	capabilities = FileCapabilities.full;

	fileName: string;
	mappings!: Mapping<FileRangeCapabilities>[];
	embeddedFiles!: VirtualFile[];

	constructor(public sourceFileName: string, public snapshot: ts.IScriptSnapshot) {
		this.fileName = sourceFileName;
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
				data: FileRangeCapabilities.full,
			},
		];

		this.embeddedFiles = [];
		this.embeddedFiles.push(
			framework2tsx(
				this.fileName,
				this.fileName,
				this.snapshot.getText(0, this.snapshot.getLength()),
				'svelte'
			)
		);
	}
}
