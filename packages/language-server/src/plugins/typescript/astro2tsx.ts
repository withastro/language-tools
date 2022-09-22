// import { TSXResult } from '@astrojs/compiler/shared/types';
import { convertToTSX } from '../../core/worker/TSXService';

export default function (
	content: string,
	fileName: string
): {
	code: string;
	map: string;
} {
	const tsx = convertToTSX(content, { sourcefile: fileName });

	return tsx;
}
