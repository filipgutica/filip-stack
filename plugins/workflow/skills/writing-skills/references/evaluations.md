# Skill evaluations

Match evaluation cost to the skill's risk.

## Routing or state-changing skills

Use scenario-based evaluation.

1. Run a control prompt without the skill or against the prior released skill.
2. Record the unsafe action, missed route, or other concrete gap.
3. Run the same prompt with the candidate skill.
4. Confirm the expected route, authority check, and refusal behavior.
5. Add a negative prompt that must not activate the skill.

Use isolated paths and test data. Do not let an evaluation publish, delete, or change production state.

## Technique skills

Use one normal scenario and one edge case. Confirm that the agent applies the method and handles missing evidence.

## Reference skills

Run structural validation. Test retrieval with one representative prompt when the reference is large or easy to misread.

## All skills

- Validate YAML frontmatter.
- Check each linked resource.
- Check host metadata and manual-only policy.
- Search for placeholders.
- Run plugin validation.
- Proofread saved technical prose.

Record the prompt, result, and remaining limit outside the distributed skill when the evaluation is session-specific.

Keep automated tests, contract validators, and their scenario fixtures outside
the distributed plugin payload. In filip-stack, store them under
`tests/workflow/skills/<skill>/`; use `contract-scenarios.json` for static
behavioral contract fixtures. Files under `plugins/workflow` must be required at
runtime by a host, hook, skill, or utility.
