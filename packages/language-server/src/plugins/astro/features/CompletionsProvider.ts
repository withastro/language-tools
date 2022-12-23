import type { FunctionDeclaration, FunctionTypeNode } from 'typescript';
import { getLanguageService } from 'vscode-html-languageservice';
import {
	CompletionContext,
	CompletionItem,
	CompletionItemKind,
	CompletionList,
	CompletionTriggerKind,
	InsertTextFormat,
	InsertTextMode,
	Range,
	MarkupContent,
	MarkupKind,
	Position,
	TextEdit,
} from 'vscode-languageserver';
import type { AstroDocument } from '../../../core/documents';
import { isInComponentStartTag, isInsideExpression, isPossibleComponent } from '../../../core/documents/utils';
import { astroDirectives } from '../../html/features/astro-attributes';
import { removeDataAttrCompletion } from '../../html/utils';
import type { AppCompletionList, CompletionsProvider } from '../../interfaces';
import type { LanguageServiceManager } from '../../typescript/LanguageServiceManager';
import { toVirtualFilePath } from '../../typescript/utils';

type LastCompletion = {
	tag: string;
	documentVersion: number;
	completions: CompletionItem[] | null;
};

// Matches import statements and dynamic imports. Captures import specifiers only.
// Adapted from: https://github.com/vitejs/vite/blob/97f8b4df3c9eb817ab2669e5c10b700802eec900/packages/vite/src/node/optimizer/scan.ts#L47-L48
const importsRE =
	/(?<!\/\/.*)(?<=^|;|\*\/)\s*(?:import(?!\s+type)(?:[\w*{}\n\r\t, ]+from)?\s*("[^"]+"|'[^']+')\s*(?=$|;|\/\/|\/\*)|import\s*\(\s*("[^"]+"|'[^']+')\s*\))/gm;

export class CompletionsProviderImpl implements CompletionsProvider {
	private readonly languageServiceManager: LanguageServiceManager;
	private readonly ts: typeof import('typescript/lib/tsserverlibrary');
	private lastCompletion: LastCompletion | null = null;

	public directivesHTMLLang = getLanguageService({
		customDataProviders: [astroDirectives],
		useDefaultDataProvider: false,
	});

	constructor(languageServiceManager: LanguageServiceManager) {
		this.languageServiceManager = languageServiceManager;
		this.ts = languageServiceManager.docContext.ts;
	}

	async getCompletions(
		document: AstroDocument,
		position: Position,
		completionContext?: CompletionContext
	): Promise<AppCompletionList | null> {
		let items: CompletionItem[] = [];

		const html = document.html;
		const offset = document.offsetAt(position);
		const node = html.findNodeAt(offset);

		const insideExpression = isInsideExpression(document.getText(), node.start, offset);

		if (completionContext?.triggerCharacter === '-' && node.parent === undefined && !insideExpression) {
			const frontmatter = this.getComponentScriptCompletion(document, position);
			if (frontmatter) items.push(frontmatter);
		}

		const { completions: flowCompletions } = await this.getFlowCompletions(document, position, completionContext);
		if (flowCompletions.length > 0) {
			items.push(...flowCompletions);
		}

		if (isInComponentStartTag(html, offset) && !insideExpression) {
			const { completions: props, componentFilePath } = await this.getPropCompletionsAndFilePath(
				document,
				position,
				completionContext
			);

			if (props.length) {
				items.push(...props);
			}

			const isAstro = componentFilePath?.endsWith('.astro');
			if (!isAstro && node.tag !== 'Fragment') {
				const directives = removeDataAttrCompletion(this.directivesHTMLLang.doComplete(document, position, html).items);
				items.push(...directives);
			}
		}

		return CompletionList.create(items, true);
	}

	private getComponentScriptCompletion(document: AstroDocument, position: Position): CompletionItem | null {
		const base: CompletionItem = {
			kind: CompletionItemKind.Snippet,
			label: '---',
			sortText: '\0',
			preselect: true,
			detail: 'Create component script block',
			insertTextFormat: InsertTextFormat.Snippet,
			commitCharacters: [],
		};

		const prefix = document.getLineUntilOffset(document.offsetAt(position));

		if (document.astroMeta.frontmatter.state === null) {
			return {
				...base,
				insertText: '---\n$0\n---',
				textEdit: prefix.match(/^\s*\-+/)
					? TextEdit.replace({ start: { ...position, character: 0 }, end: position }, '---\n$0\n---')
					: undefined,
			};
		}

		if (document.astroMeta.frontmatter.state === 'open') {
			let insertText = '---';

			// If the current line is a full component script starter/ender, the user expects a full frontmatter
			// completion and not just a completion for "---"  on the same line (which result in, well, nothing)
			if (prefix === '---') {
				insertText = '---\n$0\n---';
			}

			return {
				...base,
				insertText,
				detail: insertText === '---' ? 'Close component script block' : 'Create component script block',
				textEdit: prefix.match(/^\s*\-+/)
					? TextEdit.replace({ start: { ...position, character: 0 }, end: position }, insertText)
					: undefined,
			};
		}
		return null;
	}

	private getInjectImportTextEdit(document: AstroDocument, localNames: string[], importPackage: string): TextEdit | undefined {
		if (document.astroMeta.frontmatter.state === null) {
			return TextEdit.insert(Position.create(0, 0), `---\nimport { ${localNames.join(', ')} } from "${importPackage}";\n---\n`)
		}
		if (document.astroMeta.frontmatter.state === 'closed') {
			const start = document.positionAt(document.astroMeta.frontmatter.startOffset! + 3);
			const end = document.positionAt(document.astroMeta.frontmatter.endOffset!);
			const code = document.getText(Range.create(start.line, start.character, end.line, end.character));

			let textEdit: TextEdit | undefined;

			let m;
			importsRE.lastIndex = 0;
			while ((m = importsRE.exec(code)) != null) {
				const spec = (m[1] || m[2]).slice(1, -1);

				if (spec !== 'astro/components') {
					continue;
				}
				const existingImports = m[0].split('{')[1].split('}')[0].split(',').map(v => v.trim());
				localNames = localNames.filter(localName => !existingImports.includes(localName))

				if (localNames.length === 0) {
					return
				}
				const lastBrace = m[0].lastIndexOf('}');
				if (lastBrace === 0) {
					continue;
				}
				const whitespace = m[0].slice(0, lastBrace).length - m[0].slice(0, lastBrace).trimEnd().length;


				const offset = document.content.indexOf(m[0]) + lastBrace - whitespace;
				const pos = document.positionAt(offset)
				textEdit = TextEdit.insert(pos, `, ${localNames.join(', ')}`);
			}

			if (textEdit) {
				return textEdit;
			}

			const insideFrontmatterPosition = document.positionAt(document.astroMeta.frontmatter.startOffset! + 3);
			return TextEdit.insert(insideFrontmatterPosition, `\nimport { ${ localNames.join(', ')} } from "${importPackage}";\n`);
		}
	}

	private async getFlowCompletions(
		document: AstroDocument,
		position: Position,
		completionContext?: CompletionContext
	): Promise<{ completions: CompletionItem[]; componentFilePath: string | null }> {
		const base: CompletionItem = {
			label: '',
			kind: CompletionItemKind.Snippet,
			insertTextFormat: InsertTextFormat.Snippet,
			insertTextMode: InsertTextMode.adjustIndentation,
		}
		const flowCompletions: Record<string, CompletionItem> = {
			For: {
				...base,
				label: 'For',
				detail: 'For (Astro)',
				insertText: `<For each={\${1:items}}>\n\t{(\${1/(ie)?s$/\${1:+y}/gi}) => $3}\n</For>$0`,
			},
			Range: {
				...base,
				label: 'Range',
				detail: 'Range (Astro)',
				insertText: `<Range from={\${1:0}} to={\${2:10}}>\n\t{(i) => $3}\n</Range>$0`,
			},
			Switch: {
				...base,
				label: 'Switch',
				detail: 'Switch (Astro)',
				insertText: `<Switch on={\${1:key}}>\n\t<Case is={\${2:value}}>\n\t\t$3\n\t</Case>\n\t<Default>\n\t\t$4\n\t</Default>\n</Switch>`,
			},
			Case: {
				...base,
				label: 'Case',
				detail: 'Case (Astro)',
				insertText: `<Case is={\${1:value}}>\n\t$2\n</Case>$0`
			},
			Maybe: {
				...base,
				label: 'Maybe',
				detail: 'Maybe (Astro)',
				insertText: `<Maybe as="\${1|div,span,h1,h2,h3,h4,h5,h6|}">\n\t$2\n</Maybe>$0`
			}
		}
		const text = document
			.getText(Range.create(position.line, position.character, position.line, document.lines[position.line - 1].length))
			.trim();

		const completions: CompletionItem[] = [];

		for (const [key, completion] of Object.entries(flowCompletions)) {
			let i = 0;
			let match = false;
			for (const char of text) {
				if (i === 0 && char === '<') {
					completion.insertText = completion.insertText?.slice(1);
				} else {
					match = match || char === key[i];
					if (!match) {
						break;
					}
					i++;
				}
			}

			if (match) {
				const imports = completion.label === 'Switch' ? ['Switch', 'Case', 'Default'] : [completion.label];
				const textEdit = this.getInjectImportTextEdit(document, imports, 'astro/components');
				if (textEdit) {
					completion.additionalTextEdits = [textEdit];
				}
				completions.push(completion);
			}
		}

		return { completions, componentFilePath: null };
	}

	private async getPropCompletionsAndFilePath(
		document: AstroDocument,
		position: Position,
		completionContext?: CompletionContext
	): Promise<{ completions: CompletionItem[]; componentFilePath: string | null }> {
		const offset = document.offsetAt(position);

		const html = document.html;
		const node = html.findNodeAt(offset);

		if (!isPossibleComponent(node)) {
			return { completions: [], componentFilePath: null };
		}

		const inAttribute = node.start + node.tag!.length < offset;
		if (!inAttribute) {
			return { completions: [], componentFilePath: null };
		}

		if (completionContext?.triggerCharacter === '/' || completionContext?.triggerCharacter === '>') {
			return { completions: [], componentFilePath: null };
		}

		// If inside of attribute value, skip.
		if (
			completionContext &&
			completionContext.triggerKind === CompletionTriggerKind.TriggerCharacter &&
			completionContext.triggerCharacter === '"'
		) {
			return { completions: [], componentFilePath: null };
		}

		const componentName = node.tag!;
		const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);

		// Get the source file
		const tsFilePath = tsDoc.filePath;

		const program = lang.getProgram();
		const sourceFile = program?.getSourceFile(tsFilePath);
		const typeChecker = program?.getTypeChecker();
		if (!sourceFile || !typeChecker) {
			return { completions: [], componentFilePath: null };
		}

		// Get the import statement
		const imp = this.getImportedSymbol(sourceFile, componentName);

		const importType = imp && typeChecker.getTypeAtLocation(imp);
		if (!importType) {
			return { completions: [], componentFilePath: null };
		}

		const symbol = importType.getSymbol();
		if (!symbol) {
			return { completions: [], componentFilePath: null };
		}

		const symbolDeclaration = symbol.declarations;
		if (!symbolDeclaration) {
			return { completions: [], componentFilePath: null };
		}

		const filePath = symbolDeclaration[0].getSourceFile().fileName;
		const componentSnapshot = await this.languageServiceManager.getSnapshot(filePath);

		if (this.lastCompletion) {
			if (
				this.lastCompletion.tag === componentName &&
				this.lastCompletion.documentVersion == componentSnapshot.version
			) {
				return { completions: this.lastCompletion.completions!, componentFilePath: filePath };
			}
		}

		// Get the component's props type
		const componentType = this.getPropType(symbolDeclaration, typeChecker);
		if (!componentType) {
			return { completions: [], componentFilePath: null };
		}

		let completionItems: CompletionItem[] = [];

		// Add completions for this component's props type properties
		const properties = componentType.getProperties().filter((property) => property.name !== 'children') || [];

		properties.forEach((property) => {
			const type = typeChecker.getTypeOfSymbolAtLocation(property, imp);
			let completionItem = this.getCompletionItemForProperty(property, typeChecker, type);
			completionItems.push(completionItem);
		});

		this.lastCompletion = {
			tag: componentName,
			documentVersion: componentSnapshot.version,
			completions: completionItems,
		};

		return { completions: completionItems, componentFilePath: filePath };
	}

	private getImportedSymbol(sourceFile: ts.SourceFile, identifier: string): ts.ImportSpecifier | ts.Identifier | null {
		for (let list of sourceFile.getChildren()) {
			for (let node of list.getChildren()) {
				if (this.ts.isImportDeclaration(node)) {
					let clauses = node.importClause;
					if (!clauses) continue;
					let namedImport = clauses.getChildAt(0);

					if (this.ts.isNamedImports(namedImport)) {
						for (let imp of namedImport.elements) {
							// Iterate the named imports
							if (imp.name.getText() === identifier) {
								return imp;
							}
						}
					} else if (this.ts.isIdentifier(namedImport)) {
						if (namedImport.getText() === identifier) {
							return namedImport;
						}
					}
				}
			}
		}

		return null;
	}

	private getPropType(declarations: ts.Declaration[], typeChecker: ts.TypeChecker): ts.Type | null {
		for (const decl of declarations) {
			const fileName = toVirtualFilePath(decl.getSourceFile().fileName);
			if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx') || fileName.endsWith('.d.ts')) {
				if (!this.ts.isFunctionDeclaration(decl) && !this.ts.isFunctionTypeNode(decl)) {
					console.error(`We only support functions declarations at the moment`);
					continue;
				}

				const fn = decl as FunctionDeclaration | FunctionTypeNode;
				if (!fn.parameters.length) continue;

				const param1 = fn.parameters[0];
				const propType = typeChecker.getTypeAtLocation(param1);

				return propType;
			}
		}

		return null;
	}

	private getCompletionItemForProperty(mem: ts.Symbol, typeChecker: ts.TypeChecker, type: ts.Type) {
		const typeString = typeChecker.typeToString(type);

		let insertText = mem.name;
		switch (typeString) {
			case 'string':
				insertText = `${mem.name}="$1"`;
				break;
			case 'boolean':
				insertText = mem.name;
				break;
			default:
				insertText = `${mem.name}={$1}`;
				break;
		}

		let item: CompletionItem = {
			label: mem.name,
			detail: typeString,
			insertText: insertText,
			insertTextFormat: InsertTextFormat.Snippet,
			commitCharacters: [],
			// Ensure that props shows up first as a completion, despite this plugin being ran after the HTML one
			sortText: '\0',
		};

		if (mem.flags & this.ts.SymbolFlags.Optional) {
			item.filterText = item.label;
			item.label += '?';

			// Put optional props at a lower priority
			item.sortText = '_';
		}

		mem.getDocumentationComment(typeChecker);
		let description = mem
			.getDocumentationComment(typeChecker)
			.map((val) => val.text)
			.join('\n');

		if (description) {
			let docs: MarkupContent = {
				kind: MarkupKind.Markdown,
				value: description,
			};
			item.documentation = docs;
		}
		return item;
	}
}
