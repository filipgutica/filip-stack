// Build-time skill catalog. The README tables own the copy readers see, and each
// SKILL.md owns whether the host may select the skill on its own, and each
// THIRD_PARTY_NOTICES.md owns the upstream credit.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { marked, Renderer, type Tokens } from "marked";

export interface CatalogSkill {
  name: string;
  /** Inline HTML rendered from this repository's README. */
  summaryHtml: string;
  /** True when the skill runs only when invoked by name. */
  manual: boolean;
  /** File names in the skill's references directory. */
  references: string[];
  group: "Workflow" | "Standalone";
  source: string;
  /** Inline HTML crediting the open-source work this skill adapts; empty when none. */
  upstreamHtml: string;
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

const referenceFiles = (skillDirectory: string) => {
  const directory = join(skillDirectory, "references");
  return existsSync(directory) ? readdirSync(directory).sort() : [];
};

const isManual = (skillFile: string) =>
  /^disable-model-invocation:\s*true$/m.test(readFileSync(skillFile, "utf8"));

/**
 * Reads one credit from each "## <upstream>" section of a notices file. The
 * credit links the tracked upstream skill when the section records one, and
 * otherwise the source. `adaptedIn` lists the skills a shared notice credits.
 */
const readNotices = (file: string) =>
  readFileSync(file, "utf8")
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const heading = section.slice(0, section.indexOf("\n")).trim();
      const field = (label: string) =>
        section.match(new RegExp(`^${label}: (.+)$`, "m"))?.[1]?.trim();
      const source = field("Source");
      // MIT sections carry "Copyright (c) <year> <holder>"; others state an Author line.
      const author =
        field("Author") ??
        section.match(/^Copyright \(c\) \d{4} (.+)$/m)?.[1]?.trim();
      if (!source || !author)
        throw new Error(`${file}: "## ${heading}" needs a Source and an author`);
      const trackedPath = field("Tracked path")?.match(/^`([^`]+)`$/)?.[1];
      return {
        credit: {
          name: trackedPath ? basename(trackedPath) : heading,
          url: trackedPath ? `${source}/tree/HEAD/${trackedPath}` : source,
          author,
        },
        heading,
        adaptedIn: [...(field("Adapted in") ?? "").matchAll(/`([^`]+)`/g)].map(
          (match) => match[1]!,
        ),
      };
    });

const loadSkills = ({
  readme,
  heading,
  directory,
  group,
  sharedNotices,
}: {
  readme: string;
  heading: string;
  directory: string;
  group: CatalogSkill["group"];
  /** A plugin-wide notices file whose sections name the skills they credit. */
  sharedNotices?: string;
}) => {
  const rows = skillTable({ readme, heading });
  // Hidden folders, such as an editor's or sandbox's .claude, are not skills.
  const names = readdirSync(join(repoRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  const listed = rows.map(({ name }) => name).sort();
  if (listed.join() !== names.join()) {
    throw new Error(
      `README "## ${heading}" lists ${listed.join(", ")}, but ${directory} has ${names.join(", ")}`,
    );
  }
  const shared = sharedNotices
    ? readNotices(join(repoRoot, sharedNotices))
    : [];
  for (const { heading: upstream, adaptedIn } of shared) {
    if (!adaptedIn.length || adaptedIn.some((name) => !names.includes(name)))
      throw new Error(
        `${sharedNotices}: "## ${upstream}" must name its skills from ${directory} in "Adapted in"`,
      );
  }
  const upstreamOf = (name: string) => {
    const notices = join(repoRoot, directory, name, "THIRD_PARTY_NOTICES.md");
    return [
      ...shared.filter(({ adaptedIn }) => adaptedIn.includes(name)),
      ...(existsSync(notices) ? readNotices(notices) : []),
    ]
      .map(({ credit }) => `[${credit.name}](${credit.url}) by ${credit.author}`)
      .join(", ");
  };
  return rows.map((row) => ({
    ...row,
    group,
    source: `https://github.com/filipgutica/filip-stack/blob/main/${directory}/${row.name}/SKILL.md`,
    manual: isManual(join(repoRoot, directory, row.name, "SKILL.md")),
    references: referenceFiles(join(repoRoot, directory, row.name)),
    upstreamHtml: marked.parseInline(upstreamOf(row.name), { async: false }),
  }));
};

const headings = [
  "What it does",
  "When to use it",
  "How it works",
  "What you get",
];

// Wide tables and code blocks scroll inside these wrappers instead of widening the page.
// Each wrapper takes keyboard focus and a name so keyboard readers can scroll it.
class ContentRenderer extends Renderer {
  constructor(private readonly section: string) {
    super();
  }

  override table(token: Tokens.Table): string {
    // Headings are the fixed section names checked above, so they need no escaping.
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="${this.section} table">${super.table(token)}</div>`;
  }

  override code(token: Tokens.Code): string {
    return `<div class="code-scroll" tabindex="0" role="region" aria-label="${this.section} code">${super.code(token)}</div>`;
  }
}

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
        { renderer: new ContentRenderer(section.text) },
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
      sharedNotices: "plugins/workflow/THIRD_PARTY_NOTICES.md",
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
