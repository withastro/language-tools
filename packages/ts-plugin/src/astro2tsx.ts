// import { TSXResult } from '@astrojs/compiler/shared/types';
import { convertToTSX } from './workers/TSXService';

interface SourceMap {
	file: string;
	mappings: string;
	names: string[];
	sources: string[];
	sourcesContent: string[];
	version: number;
}
export interface TSXResult {
	code: string;
	map: SourceMap;
}

export function astro2tsx(content: string, fileName: string): TSXResult {
	const tsx = convertToTSX(content, { sourcefile: fileName });

	return tsx;
}
