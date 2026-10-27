// Build-time skill catalog. The README tables own the copy readers see, and each
// SKILL.md owns whether the host may select the skill on its own.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { marked, type Tokens } from 'marked';

export interface CatalogSkill {
  name: string;
  /** Inline HTML rendered from this repository's README. */
  summaryHtml: string;
  /** True when the skill runs only when invoked by name. */
  manual: boolean;
}

export interface Catalog {
  workflow: CatalogSkill[];
  standalone: CatalogSkill[];
}

// Astro runs the build from docs/site.
const repoRoot = resolve(process.cwd(), '../..');

const skillTable = ({ readme, heading }: { readme: string; heading: string }) => {
  const tokens = marked.lexer(readme);
  const start = tokens.findIndex((token) => token.type === 'heading' && token.depth === 2 && token.text === heading);
  if (start === -1) throw new Error(`README has no "## ${heading}" section`);
  const table = tokens.slice(start + 1).find((token): token is Tokens.Table => token.type === 'table');
  if (!table) throw new Error(`README "## ${heading}" has no skill table`);
  return table.rows.map(([name, summary]) => ({
    name: name.text.replaceAll('`', ''),
    summaryHtml: marked.parseInline(summary.text, { async: false }),
  }));
};

const isManual = (skillFile: string) => /^disable-model-invocation:\s*true$/m.test(readFileSync(skillFile, 'utf8'));

const loadSkills = ({ readme, heading, directory }: { readme: string; heading: string; directory: string }) => {
  const rows = skillTable({ readme, heading });
  const names = readdirSync(join(repoRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const listed = rows.map(({ name }) => name).sort();
  if (listed.join() !== names.join()) {
    throw new Error(`README "## ${heading}" lists ${listed.join(', ')}, but ${directory} has ${names.join(', ')}`);
  }
  return rows.map((row) => ({ ...row, manual: isManual(join(repoRoot, directory, row.name, 'SKILL.md')) }));
};

export const loadCatalog = (): Catalog => {
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  return {
    workflow: loadSkills({ readme, heading: 'Workflow', directory: 'plugins/workflow/skills' }),
    standalone: loadSkills({ readme, heading: 'Standalone skills', directory: 'skills' }),
  };
};
