import type { CodeMapping, VirtualCode } from '@volar/language-core';
import * as devalue from 'devalue';
import type * as ts from 'typescript';
import type { YAMLError, YAMLMap, YAMLSeq } from 'yaml';
import YAML, { CST, isCollection, isMap, isScalar, isSeq, LineCounter, parseDocument } from 'yaml';

const FRONTMATTER_OFFSET = 0;

export type YAML2TSResult = {
	errors: YAMLError[];
	virtualCode: VirtualCode;
};

export function yaml2ts(
	frontmatter: string,
	snapshot: ts.IScriptSnapshot,
	collection = 'blog',
): YAML2TSResult {
	const frontmatterMappings: CodeMapping[] = [];
	const lineCounter = new LineCounter();
	const frontmatterContent = parseDocument(frontmatter, {
		keepSourceTokens: true,
		lineCounter: lineCounter,
		strict: false,
		logLevel: 'silent',
		customTags: ['timestamp'],
	});

	let hasLeadingWhitespace = frontmatter.startsWith('\n');
	let hasTrailingWhitespace = frontmatter.endsWith('\n\n');

	let resultText = 'import type { InferEntrySchema } from "astro:content";\n\n(\n';
	let parsedContent = frontmatter.trim().length > 0 ? '' : '{}'; // If there's no content, provide an empty object so that there's no syntax error

	if (hasLeadingWhitespace) {
		parsedContent += '\n';
		frontmatterMappings.push({
			sourceOffsets: [FRONTMATTER_OFFSET],
			generatedOffsets: [resultText.length],
			lengths: [0],
			data: {
				verification: false,
				completion: false,
				semantic: false,
				navigation: true,
				structure: false,
				format: false,
			},
		});
	}

	YAML.visit(frontmatterContent, {
		Value(key, value) {
			if (isCollection(value)) {
				if (isMap(value)) {
					mapMap(value, key);
				}

				if (isSeq(value)) {
					mapSeq(value);
				}
			}

			if (isScalar(value)) {
				let valueValue = stringifyValue(value);

				frontmatterMappings.push({
					generatedOffsets: [resultText.length + parsedContent.length],
					sourceOffsets: [value.range![0] + FRONTMATTER_OFFSET],
					lengths: [valueValue.length],
					generatedLengths: [valueValue.length],
					data: {
						verification: false,
						completion: false,
						semantic: false,
						navigation: true,
						structure: false,
						format: false,
					},
				});

				parsedContent += `${valueValue},\n`;
			}

			return YAML.visit.REMOVE;
		},
	});

	function mapMap(map: YAMLMap, key?: string | number | null) {
		parsedContent += '{\n';

		// Go through all the items in the map
		map.items.forEach((item) => {
			// The items from a map are guaranteed to be pairs
			if (isScalar(item.key)) {
				if (item.value === null) {
					const valueKey = JSON.stringify(item.key.toJS(frontmatterContent));

					frontmatterMappings.push({
						generatedOffsets: [resultText.length + parsedContent.length],
						sourceOffsets: [item.key.range![0] + FRONTMATTER_OFFSET],
						lengths: CST.isScalar(item.key.srcToken) ? [item.key.srcToken.source.length] : [0],
						data: {
							verification: false,
							completion: false,
							semantic: false,
							navigation: true,
							structure: false,
							format: false,
						},
					});

					parsedContent += `${valueKey}\n`;
				}

				// If we have a fully formed pair with a scalar key and a scalar value
				if (isScalar(item.value)) {
					const valueKey = JSON.stringify(item.key.toJS(frontmatterContent));
					const valueValue = stringifyValue(item.value);

					// Key
					let generatedOffsets = [resultText.length + parsedContent.length];
					let generatedLengths = [valueKey.length];
					let sourceOffsets = [item.key.range![0] + FRONTMATTER_OFFSET];
					let sourceLengths = CST.isScalar(item.key.srcToken)
						? [item.key.srcToken.source.length]
						: [0];

					// Map the value if it's not "null"
					if (valueValue !== 'null') {
						generatedOffsets.push(resultText.length + parsedContent.length + valueKey.length + 2);
						generatedLengths.push(valueValue.length);

						sourceOffsets.push(item.value.range![0] + FRONTMATTER_OFFSET);

						let sourceLength = CST.isScalar(item.value.srcToken)
							? item.value.srcToken.source.length
							: 0;
						sourceLengths.push(sourceLength);
					}

					frontmatterMappings.push({
						generatedOffsets,
						sourceOffsets,
						lengths: sourceLengths,
						generatedLengths,
						data: {
							verification: false,
							completion: false,
							semantic: false,
							navigation: true,
							structure: false,
							format: false,
						},
					});

					parsedContent += `${valueKey}: ${valueValue},\n`;
				}

				if (isMap(item.value)) {
					const itemKey = JSON.stringify(item.key.toJS(frontmatterContent));

					frontmatterMappings.push({
						generatedOffsets: [resultText.length + parsedContent.length],
						sourceOffsets: [item.key.range![0] + FRONTMATTER_OFFSET],
						lengths: CST.isScalar(item.key.srcToken) ? [item.key.srcToken.source.length] : [0],
						generatedLengths: [itemKey.length],
						data: {
							verification: false,
							completion: false,
							semantic: false,
							navigation: true,
							structure: false,
							format: false,
						},
					});

					parsedContent += `${itemKey}: `;

					mapMap(item.value);
				}

				if (isSeq(item.value)) {
					const itemKey = JSON.stringify(item.key.toJS(frontmatterContent));

					frontmatterMappings.push({
						generatedOffsets: [resultText.length + parsedContent.length],
						sourceOffsets: [item.key.range![0] + FRONTMATTER_OFFSET],
						lengths: CST.isScalar(item.key.srcToken) ? [item.key.srcToken.source.length] : [0],
						generatedLengths: [itemKey.length],
						data: {
							verification: false,
							completion: false,
							semantic: false,
							navigation: true,
							structure: false,
							format: false,
						},
					});

					parsedContent += `${itemKey}: `;

					mapSeq(item.value);
				}

				return YAML.visit.REMOVE;
			}
		});

		parsedContent += '}';

		if (key !== null) {
			parsedContent += ',';
		}

		parsedContent += '\n';

		return YAML.visit.REMOVE;
	}

	function mapSeq(seq: YAMLSeq) {
		parsedContent += '[';

		seq.items.forEach((item) => {
			if (isScalar(item)) {
				const valueValue = stringifyValue(item);

				parsedContent += `${valueValue},`;
			}

			if (isMap(item)) {
				mapMap(item);
			}

			if (isSeq(item)) {
				mapSeq(item);
			}
		});

		parsedContent += '],\n';

		return YAML.visit.REMOVE;
	}

	function stringifyValue(value: YAML.Scalar) {
		const jsValue = value.toJS(frontmatterContent);
		return devalue.uneval(jsValue);
	}

	resultText += parsedContent;

	if (hasTrailingWhitespace) {
		frontmatterMappings.push({
			sourceOffsets: [snapshot.getText(0, snapshot.getLength()).indexOf('---', 3) - 1],
			generatedOffsets: [resultText.length],
			lengths: [0],
			data: {
				verification: false,
				completion: false,
				semantic: false,
				navigation: true,
				structure: false,
				format: false,
			},
		});

		resultText += '\n';
	}

	resultText += `) satisfies InferEntrySchema<"${collection}">;\n\n`;

	return {
		errors: frontmatterContent.errors,
		virtualCode: {
			id: 'frontmatter-ts',
			languageId: 'typescript',
			snapshot: {
				getText: (start, end) => resultText.substring(start, end),
				getLength: () => resultText.length,
				getChangeRange: () => undefined,
			},
			mappings: frontmatterMappings,
		},
	};
}
