import type ts from 'typescript/lib/tsserverlibrary';
import type { AstroSnapshotManager } from '../astro-snapshots.js';
import type { Logger } from '../logger';
import { decorateCompletions } from './completions.js';
import { decorateGetDefinition } from './definition.js';
import { decorateDiagnostics } from './diagnostics.js';
import { decorateFindReferences } from './find-references.js';
import { decorateGetImplementation } from './implementation.js';
import { decorateLineColumnOffset } from './line-column-offset.js';
import { decorateRename } from './rename.js';

export function decorateLanguageService(
	ls: ts.LanguageService,
	snapshotManager: AstroSnapshotManager,
	logger: Logger
): ts.LanguageService {
	decorateLineColumnOffset(ls, snapshotManager);
	decorateRename(ls, snapshotManager, logger);
	decorateDiagnostics(ls, logger);
	decorateFindReferences(ls, snapshotManager, logger);
	decorateCompletions(ls, logger);
	decorateGetDefinition(ls, snapshotManager, logger);
	decorateGetImplementation(ls, snapshotManager, logger);

	return ls;
}
