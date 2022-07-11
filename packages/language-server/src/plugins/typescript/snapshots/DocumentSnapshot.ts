import { EncodedSourceMap, TraceMap } from '@jridgewell/trace-mapping';
import type { Position, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import {
	AstroDocument,
	DocumentMapper,
	FragmentMapper,
	getLineOffsets,
	IdentityMapper,
	offsetAt,
	positionAt,
	TagInformation,
	SourceMapDocumentMapper,
} from '../../../core/documents';
import { pathToUrl } from '../../../utils';
import type { FrameworkExt } from '../utils';

export interface DocumentSnapshot extends ts.IScriptSnapshot {
	version: number;
	filePath: string;
	scriptKind: ts.ScriptKind;
	positionAt(offset: number): Position;
	/**
	 * Instantiates a source mapper.
	 */
	createFragment(): SnapshotFragment;
	/**
	 * Convenience function for getText(0, getLength())
	 */
	getFullText(): string;
}

/**
 * The mapper to get from original snapshot positions to generated and vice versa.
 */
export interface SnapshotFragment extends DocumentMapper {
	positionAt(offset: number): Position;
	offsetAt(position: Position): number;
}

/**
 * Snapshots used for Astro files
 */
export class AstroSnapshot implements DocumentSnapshot {
	private fragment?: AstroSnapshotFragment;
	version = this.parent.version;
	public scriptTagSnapshots: ScriptTagDocumentSnapshot[] = [];

	constructor(
		public readonly parent: AstroDocument,
		private readonly text: string,
		private readonly map: EncodedSourceMap,
		public readonly scriptKind: ts.ScriptKind
	) {}

	createFragment() {
		if (!this.fragment) {
			const uri = pathToUrl(this.filePath);
			this.fragment = new AstroSnapshotFragment(
				new ConsumerDocumentMapper(new TraceMap(this.map), uri, 0),
				this.parent,
				this.text,
				uri
			);
		}
		return this.fragment;
	}

	get filePath() {
		return this.parent.getFilePath() || '';
	}

	getText(start: number, end: number): string {
		return this.text.substring(start, end);
	}

	getLength() {
		return this.text.length;
	}

	getFullText() {
		return this.text;
	}

	getChangeRange() {
		return undefined;
	}

	positionAt(offset: number) {
		return positionAt(offset, this.text);
	}
}

export class AstroSnapshotFragment implements SnapshotFragment {
	private lineOffsets = getLineOffsets(this.text);

	constructor(
		private readonly mapper: DocumentMapper,
		public readonly parent: AstroDocument,
		public readonly text: string,
		private readonly url: string
	) {}

	positionAt(offset: number) {
		return positionAt(offset, this.text, this.lineOffsets);
	}

	offsetAt(position: Position) {
		return offsetAt(position, this.text, this.lineOffsets);
	}

	getOriginalPosition(pos: Position): Position {
		return this.mapper.getOriginalPosition(pos);
	}

	getGeneratedPosition(pos: Position): Position {
		return this.mapper.getGeneratedPosition(pos);
	}

	isInGenerated(pos: Position): boolean {
		throw new Error('Method not implemented.');
	}

	getURL(): string {
		return this.url;
	}
}

export class ScriptTagDocumentSnapshot extends FragmentMapper implements DocumentSnapshot, SnapshotFragment {
	readonly version = this.parent.version;
	private text = this.parent.getText().slice(this.scriptTag.start, this.scriptTag.end) + '\nexport {}';
	private lineOffsets?: number[];

	constructor(
		public scriptTag: TagInformation,
		private readonly parent: AstroDocument,
		public filePath: string,
		public readonly scriptKind: ts.ScriptKind
	) {
		super(parent.getText(), scriptTag, filePath);
	}

	positionAt(offset: number) {
		return positionAt(offset, this.text, this.getLineOffsets());
	}

	offsetAt(position: Position): number {
		return offsetAt(position, this.text, this.getLineOffsets());
	}

	createFragment(): SnapshotFragment {
		return this;
	}

	getText(start: number, end: number) {
		return this.text.substring(start, end);
	}

	getLength() {
		return this.text.length;
	}

	getFullText() {
		return this.text;
	}

	getChangeRange() {
		return undefined;
	}

	private getLineOffsets() {
		if (!this.lineOffsets) {
			this.lineOffsets = getLineOffsets(this.text);
		}
		return this.lineOffsets;
	}
}

/**
 * Snapshot used for anything that is not an Astro file
 * It's both used for .js(x)/.ts(x) files and .svelte/.vue files
 */
export class TypeScriptDocumentSnapshot extends IdentityMapper implements DocumentSnapshot, SnapshotFragment {
	scriptKind: ts.ScriptKind;
	private lineOffsets?: number[];

	constructor(
		public version: number,
		public readonly filePath: string,
		private text: string,
		scriptKind: ts.ScriptKind,
		public readonly framework?: FrameworkExt
	) {
		super(pathToUrl(filePath));

		this.scriptKind = scriptKind;
	}

	getText(start: number, end: number) {
		return this.text.substring(start, end);
	}

	getLength() {
		return this.text.length;
	}

	getFullText() {
		return this.text;
	}

	getChangeRange() {
		return undefined;
	}

	positionAt(offset: number) {
		return positionAt(offset, this.text, this.getLineOffsets());
	}

	offsetAt(position: Position): number {
		return offsetAt(position, this.text, this.getLineOffsets());
	}

	createFragment() {
		return this;
	}

	update(changes: TextDocumentContentChangeEvent[]): void {
		for (const change of changes) {
			let start = 0;
			let end = 0;
			if ('range' in change) {
				start = this.offsetAt(change.range.start);
				end = this.offsetAt(change.range.end);
			} else {
				end = this.getLength();
			}

			this.text = this.text.slice(0, start) + change.text + this.text.slice(end);
		}

		this.version++;
		this.lineOffsets = undefined;
	}

	private getLineOffsets() {
		if (!this.lineOffsets) {
			this.lineOffsets = getLineOffsets(this.text);
		}
		return this.lineOffsets;
	}
}

export class ConsumerDocumentMapper extends SourceMapDocumentMapper {
	constructor(traceMap: TraceMap, sourceUri: string, private nrPrependesLines: number) {
		super(traceMap, sourceUri);
	}

	getOriginalPosition(generatedPosition: Position): Position {
		return super.getOriginalPosition(
			Position.create(generatedPosition.line - this.nrPrependesLines, generatedPosition.character)
		);
	}

	getGeneratedPosition(originalPosition: Position): Position {
		const result = super.getGeneratedPosition(originalPosition);
		result.line += this.nrPrependesLines;
		return result;
	}

	isInGenerated(): boolean {
		// always return true and map outliers case by case
		return true;
	}
}
