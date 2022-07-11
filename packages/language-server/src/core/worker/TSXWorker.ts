import { runAsWorker } from 'synckit';

const dynamicImport = new Function('m', 'return import(m)');
runAsWorker(async (source, fileName) => {
	const { convertToTSX } = await dynamicImport('@astrojs/compiler');
	const result = convertToTSX(source, { sourcefile: fileName });
	return result;
});
