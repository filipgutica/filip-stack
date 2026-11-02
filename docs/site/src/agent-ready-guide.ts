import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Marked, Renderer, type Tokens } from "marked";

export interface GuideSection {
  id: string;
  html: string;
}

// Like the catalog, this runs only during Astro's build, from docs/site.
export const loadAgentReadyGuide = (): GuideSection[] => {
  const directory = resolve(
    process.cwd(),
    "../../skills/agent-ready-environments",
  );
  const references = [
    ...readdirSync(join(directory, "references"))
      .filter((file) => /^pillar-\d-.*\.md$/.test(file))
      .sort(),
    "maintenance.md",
  ];
  const links = new Map([["../SKILL.md", "#agent-ready-environments"]]);
  for (const file of references) {
    const anchor = `#${file.replace(/\.md$/, "")}`;
    links.set(file, anchor);
    links.set(`references/${file}`, anchor);
  }
  const slug = (text: string) => text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return ["SKILL.md", ...references].flatMap((file) => {
    const isSkill = file === "SKILL.md";
    const id = isSkill ? "agent-ready-environments" : file.replace(/\.md$/, "");
    const markdown = readFileSync(
      join(directory, isSkill ? file : `references/${file}`),
      "utf8",
    )
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
      .replace(
        /^Source keys refer to the Sources list in \[SKILL\.md\]\(\.\.\/SKILL\.md\)\.\r?\n/gm,
        "",
      );
    const renderer = new Marked({
      walkTokens(token) {
        if (token.type === "link")
          token.href = links.get(token.href) ?? token.href;
      },
      renderer: {
        heading({ depth, text, tokens }) {
          const headingId = depth === 1
            ? id
            : isSkill ? slug(text) : `${id}-${slug(text)}`;
          const level = isSkill ? depth : depth + 1;
          return `<h${level} id="${headingId}">${this.parser.parseInline(tokens)}</h${level}>\n`;
        },
        table(token) {
          return `<div class="guide-table">${Renderer.prototype.table.call(this, token)}</div>`;
        },
      },
    });
    const tokens = renderer.lexer(markdown);
    // Keep SKILL.md's sections in the site's normal article layout. Each
    // reference is one section, with its own headings nested below h2.
    const headings = tokens.filter(
      (token): token is Tokens.Heading =>
        token.type === "heading" && token.depth <= (isSkill ? 2 : 1),
    );
    return headings.map((heading, index) => ({
      id: heading.depth === 1 ? id : slug(heading.text),
      html: renderer.parse(
        tokens.slice(
          tokens.indexOf(heading),
          index + 1 < headings.length
            ? tokens.indexOf(headings[index + 1]!)
            : undefined,
        ).map((token) => token.raw).join(""),
        { async: false },
      ),
    }));
  });
};
