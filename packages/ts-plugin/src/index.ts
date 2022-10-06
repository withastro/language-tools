import type ts from 'typescript/lib/tsserverlibrary';
import { AstroSnapshotManager } from './astro-snapshots.js';
import { decorateLanguageService } from './language-service/index.js';
import { Logger } from './logger.js';
import { patchModuleLoader } from './module-loader.js';
import { ProjectAstroFilesManager } from './project-astro-files.js';
import { getConfigPathForProject } from './utils.js';

function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
	const ts = modules.typescript;

	function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
		const logger = new Logger(info.project.projectService.logger);

		if (!isAstroProject(info.project.getCompilerOptions())) {
			logger.log('Detected that this is not an Astro project, abort patching TypeScript');
			return info.languageService;
		}

		logger.log('Starting Astro plugin');

		const snapshotManager = new AstroSnapshotManager(modules.typescript, info.project.projectService, logger);
		const parsedCommandLine = info.languageServiceHost.getParsedCommandLine?.(getConfigPathForProject(info.project));
		const projectAstroFilesManager = parsedCommandLine
			? new ProjectAstroFilesManager(
					modules.typescript,
					info.project,
					info.serverHost,
					snapshotManager,
					parsedCommandLine
			  )
			: undefined;

		patchModuleLoader(logger, snapshotManager, modules.typescript, info.languageServiceHost, info.project);
		return decorateLanguageService(info.languageService, snapshotManager, logger);
	}

	function getExternalFiles(project: ts.server.ConfiguredProject) {
		return ProjectAstroFilesManager.getInstance(project.getProjectName())?.getFiles() ?? [];
	}

	function isAstroProject(compilerOptions: ts.CompilerOptions) {
		// Add more checks like "no Astro file found" or "no config file found"?
		try {
			const hasAstroInstalled =
				typeof compilerOptions.configFilePath !== 'string' ||
				require.resolve('astro', { paths: [compilerOptions.configFilePath] });
			return hasAstroInstalled;
		} catch (e) {
			return false;
		}
	}

	return { create, getExternalFiles };
}

export = init;
