---
name: ste-writing
description: >-
  Use when writing or rewriting a finished deliverable that explains, specifies, instructs, records, or reports technical work.
  Examples include documentation, specifications, tickets, skills, PR descriptions, reports, procedures, safety text, error messages, and code comments.
---

# ste-writing

Use ASD-STE100 Simplified Technical English for a finished deliverable that explains, specifies, instructs, records, or reports technical work. This includes documentation, specifications, tickets, skills, PR descriptions, reports, procedures, safety text, error messages, and code comments.

A finished deliverable is text that the agent will save, post, send, or give to the user for one of those actions. Ordinary session replies are outside this skill.

Edit prose only. Preserve facts, links, citations, required structure, and evidence labels. Preserve code blocks, inline code, frontmatter, structured sections, identifiers, commands, syntax, required templates, and established technical terms. Correctness and required formats take precedence over style rules.

Do not use STE for marketing copy. Do not use it when the requested format must preserve a specific personal or conversational voice. Examples include personal messages, opinion pieces, speeches, essays, and narrative posts. This exception applies even when the subject is technical. Use STE for excluded content only when the user explicitly requests STE.

## Rules

WORDS
- Use one name for one thing. Do not call the same item by two different names.
- Use the short common word: start (not begin/commence/initiate), use (not utilize/leverage), help (not facilitate), make sure (not ensure), before (not prior to), after (not subsequent to), about (not regarding/concerning), get (not obtain/acquire), show (not demonstrate), also (not additionally/furthermore/moreover).
- Give each word one meaning. "fall" means to move down, not to decrease.
- No marketing adjectives: seamless, robust, powerful, cutting-edge, effortless, world-class, next-generation, revolutionary.
- American spelling.

VERBS
- Active voice. "the parser reads the file", not "the file is read by the parser".
- Use a verb for an action. "analyze the log", not "perform an analysis of the log".
- No stacked auxiliaries. Not "it is important to note that this may help to improve". Write "this improves X".
- No "-ing" main verb where a simple tense works.

SENTENCES
- One instruction per sentence. Max 20 words (instruction), max 25 (descriptive).
- No contractions. Use articles: a, an, the, this, these.

PUNCTUATION
- No semicolons. Write two sentences. STE permits em dashes. Remove them when the requested style does not permit them.

STRUCTURE
- One topic per paragraph, max six sentences. For steps, use a numbered vertical list, one action per item, imperative form. Put a condition before its command.

Write only the requested text. No preamble, no summary, no closing remarks.

## Modes

- **strict:** Use this mode by default for every deliverable in scope. Apply every rule and both length caps.
- **STE-flavored:** Use this mode only when the user explicitly requests STE-flavored mode. Keep the structure and verb rules. Relax the dictionary and length caps.

## Self-lint (run before returning text)

1. Any sentence over 20 words? Split it.
2. Any semicolon? Replace with a period.
3. Any contraction? Expand it.
4. Any passive voice with a known actor? Make it active.
5. Any "-ing" main verb, nominalization ("perform an analysis"), or phrasal verb ("spin up")? Replace with a plain verb.
6. Same thing named two ways? Pick one name.

The mechanical rules above are lintable and remove common forms of unclear prose. Full STE also needs human judgment. A checker cannot certify it.

This skill improves the form of prose. It cannot make unsupported content accurate.

Free official standard: https://asd-ste100.org. Do not paste the full standard because it is copyrighted.
