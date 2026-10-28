// Build-time skill catalog. The README tables own the copy readers see, and each
// SKILL.md owns whether the host may select the skill on its own.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { marked, type Tokens } from "marked";

export interface CatalogSkill {
  name: string;
  /** Inline HTML rendered from this repository's README. */
  summaryHtml: string;
  /** True when the skill runs only when invoked by name. */
  manual: boolean;
  group: "Workflow" | "Standalone";
  source: string;
}

export interface SkillContent {
  related: string[];
  sections: { id: string; heading: string; html: string }[];
}

export interface Catalog {
  workflow: CatalogSkill[];
  standalone: CatalogSkill[];
}

// Astro runs the build from docs/site.
const repoRoot = resolve(process.cwd(), "../..");

const skillTable = ({
  readme,
  heading,
}: {
  readme: string;
  heading: string;
}) => {
  const tokens = marked.lexer(readme);
  const start = tokens.findIndex(
    (token) =>
      token.type === "heading" && token.depth === 2 && token.text === heading,
  );
  if (start === -1) throw new Error(`README has no "## ${heading}" section`);
  const table = tokens
    .slice(start + 1)
    .find((token): token is Tokens.Table => token.type === "table");
  if (!table) throw new Error(`README "## ${heading}" has no skill table`);
  return table.rows.map(([name, summary]) => ({
    name: name.text.replaceAll("`", ""),
    summaryHtml: marked.parseInline(summary.text, { async: false }),
  }));
};

const isManual = (skillFile: string) =>
  /^disable-model-invocation:\s*true$/m.test(readFileSync(skillFile, "utf8"));

const loadSkills = ({
  readme,
  heading,
  directory,
  group,
}: {
  readme: string;
  heading: string;
  directory: string;
  group: CatalogSkill["group"];
}) => {
  const rows = skillTable({ readme, heading });
  const names = readdirSync(join(repoRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const listed = rows.map(({ name }) => name).sort();
  if (listed.join() !== names.join()) {
    throw new Error(
      `README "## ${heading}" lists ${listed.join(", ")}, but ${directory} has ${names.join(", ")}`,
    );
  }
  return rows.map((row) => ({
    ...row,
    group,
    source: `https://github.com/filipgutica/filip-stack/blob/main/${directory}/${row.name}/SKILL.md`,
    manual: isManual(join(repoRoot, directory, row.name, "SKILL.md")),
  }));
};

const headings = [
  "What it does",
  "When to use it",
  "How it works",
  "What you get",
];

const loadContent = ({
  name,
  names,
}: {
  name: string;
  names: string[];
}): SkillContent => {
  const file = join(repoRoot, "docs/site/src/content/skills", `${name}.md`);
  const markdown = readFileSync(file, "utf8");
  // Content pages use one deliberately small frontmatter contract: related names.
  const frontmatter = markdown.match(
    /^---\r?\nrelated: \[([^\]\r\n]*)\]\r?\n---\r?\n/,
  );
  if (!frontmatter)
    throw new Error(`${file}: expected related: [skill, ...] frontmatter`);
  const related = frontmatter[1]!
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const relatedName of related) {
    if (!names.includes(relatedName))
      throw new Error(`${file}: unknown related skill "${relatedName}"`);
  }
  const tokens = marked.lexer(markdown.slice(frontmatter[0].length));
  const sections = tokens.filter(
    (token): token is Tokens.Heading => token.type === "heading",
  );
  if (
    sections.length !== headings.length ||
    sections.some(
      (section, index) =>
        section.depth !== 2 || section.text !== headings[index],
    )
  ) {
    throw new Error(
      `${file}: sections must be exactly ${headings.join(", ")} in that order`,
    );
  }
  if (
    tokens
      .slice(0, tokens.indexOf(sections[0]!))
      .some((token) => token.type !== "space")
  ) {
    throw new Error(`${file}: content must start with "## What it does"`);
  }
  return {
    related,
    sections: sections.map((section, index) => ({
      heading: section.text,
      id: section.text.toLowerCase().replaceAll(" ", "-"),
      html: marked.parser(
        tokens.slice(
          tokens.indexOf(section) + 1,
          index + 1 < sections.length
            ? tokens.indexOf(sections[index + 1]!)
            : undefined,
        ),
      ),
    })),
  };
};

export const loadCatalog = (): {
  catalog: Catalog;
  contents: Record<string, SkillContent>;
} => {
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  const catalog: Catalog = {
    workflow: loadSkills({
      readme,
      heading: "Workflow",
      directory: "plugins/workflow/skills",
      group: "Workflow",
    }),
    standalone: loadSkills({
      readme,
      heading: "Standalone skills",
      directory: "skills",
      group: "Standalone",
    }),
  };
  const workflowOrder = [
    "engineering",
    "planning",
    "review",
    "test-audit",
    "technical-writing",
    "simplify",
    "grill-me",
    "walkthrough",
    "checkpoint",
  ];
  catalog.workflow.sort(
    (a, b) => workflowOrder.indexOf(a.name) - workflowOrder.indexOf(b.name),
  );
  const names = [...catalog.workflow, ...catalog.standalone]
    .map(({ name }) => name)
    .sort();
  const pages = readdirSync(join(repoRoot, "docs/site/src/content/skills"))
    .map((file) => file.replace(/\.md$/, ""))
    .sort();
  if (pages.join() !== names.join()) {
    throw new Error(
      `Skill content pages must match skill directories. Skills: ${names.join(", ")}; pages: ${pages.join(", ")}`,
    );
  }
  return {
    catalog,
    contents: Object.fromEntries(
      names.map((name) => [name, loadContent({ name, names })]),
    ),
  };
};
