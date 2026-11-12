// Reads SKILL.md frontmatter fields the way hosts see them. Shared by the skill
// validators and the routing guidance test.

export const frontmatterOf = (skill) => skill.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? ''

// Returns the raw description: the single-line value, or the lines of a folded
// (`>-`) or literal (`|`) block.
export const descriptionOf = (frontmatter) => {
  const match = `${frontmatter}\n`.match(/^description:[ \t]*(.*)\n((?:[ \t]+.*\n|[ \t]*\n)*)/mu)
  if (!match) return ''
  return /^[>|][1-9+-]{0,2}\s*(?:#.*)?$/u.test(match[1]) ? match[2] : match[1]
}

export const isManual = (frontmatter) => /^disable-model-invocation:\s*true$/mu.test(frontmatter)

// Returns the fields a skill catalog shows, with the description on one line and unquoted.
export const parseSkill = (text) => {
  const frontmatter = frontmatterOf(text)
  return {
    name: frontmatter.match(/^name:\s*(.+)$/mu)?.[1].trim(),
    description: descriptionOf(frontmatter).replace(/\s+/gu, ' ').trim().replace(/^"(.*)"$/u, '$1'),
    manual: isManual(frontmatter),
    body: text.replace(/^---\n[\s\S]*?\n---\n?/u, ''),
    text,
  }
}
