import type { FileMapping } from './source-mapper';
import { readFileSync } from 'fs';

const ASTRO_DEFINITION = readFileSync(require.resolve('../astro.d.ts'));

// Note that this is a bit of a hack until the new compiler with proper
// source map support.

interface Astro2TSXOptions {
  filename: string | undefined;
  isTsFile: boolean;
}

interface Astro2TSXResult {
  code: string;
  map: {
    mappings: FileMapping
  }
}

export function astro2tsx(code: string, options: Astro2TSXOptions): Astro2TSXResult {
  const compiled =  transformContent(code);

  const result: Astro2TSXResult = {
    code: compiled,
    map: {
      mappings: []
    }
  };
  
  return result;
}

// This is hacky but it works for now
function addProps(content: string, dtsContent: string): string {
  let defaultExportType = 'Record<string, any>';
  if(/interface Props/.test(content)) {
    defaultExportType = 'Props';
  }
  return dtsContent + '\n' + `export default function (props: ${defaultExportType}): string;`
}

function transformContent(content: string) {
  return (
    content.replace(/---/g, '///') +
    // Add TypeScript definitions
    addProps(content, ASTRO_DEFINITION.toString('utf-8'))
  );
}