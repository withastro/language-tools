import { HTMLDocument } from 'vscode-html-languageservice';
import { CSSDocument } from '../../plugins/css/CSSDocument';
import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { parseHtml } from './parseHTML';
import { extractStyleTags, TagInformation } from './utils';

export class AstroDocument extends WritableDocument {
	languageId = 'astro';
	html!: HTMLDocument;
	styleTags!: TagInformation[];

	constructor(public url: string, public content: string) {
		super();

		this.updateDocInfo();
	}

	private updateDocInfo() {
		this.html = parseHtml(this.content);
		this.styleTags = extractStyleTags(this.content, this.html);
	}

	setText(text: string): void {
		this.content = text;
		this.version++;
		this.updateDocInfo();
	}

	getText(): string {
		return this.content;
	}

	getURL(): string {
		return this.url;
	}

	getFilePath(): string | null {
		return urlToPath(this.url);
	}
}
