import { readFileSync } from 'fs';
import { EOL } from 'os';

const ASTRO_DEFINITION_BYTES = readFileSync(require.resolve('../../../astro.d.ts'));
const ASTRO_DEFINITION_STR = ASTRO_DEFINITION_BYTES.toString('utf-8');

function addProps(content: string, dtsContent: string): string {
  let defaultExportType = 'Record<string, any>';
  // Using TypeScript to parse here would cause a double-parse, slowing down the extension
  // This needs to be done a different way when the new compiler is added.
  if(/(interface|type) Props/.test(content)) {
    defaultExportType = 'Props';
  }
  return dtsContent + EOL + `export default function (_props: ${defaultExportType}) { return <div></div>; }`
}

function escapeTemplateLiteralContent(content: string) {
  return content.replace(/`/g, '\`');
}

export default function(content: string) {
  // Replace frontmatter marks with comments
  let raw = content
    .replace(/---/g, '///')
    // Turn styles into internal strings
    .replace(/<\s*style([^>]*)>(.*?)<\s*\/\s*style>/gs, (_whole, attrs, children) => {
      return `<style${attrs}>{\`${children}\`}</style>`;
    })
    // Turn comments into JS comments
    .replace(/<\s*!--([^>]*)(.*?)-->/g, (whole) => {
      return `{/*${whole}*/}`;
    })
    // Close void elements
    .replace(/<(\s*(meta|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)([^>]*))>/g, (whole, inner) => {
      if(whole.endsWith('/>')) return whole;
      return `<${inner} />`;
    })


  return (
    raw + EOL +

    // Add TypeScript definitions
    addProps(raw, ASTRO_DEFINITION_STR)
  );
}