# Review standard

Review the submitted change as the engineer who will maintain this code next. Judge the code as it now stands in the repository, not the process that produced it. Apply the same standard to every submission.

Report a finding only for a concrete problem in the changed code or in code the change should have touched. Give the file, the line, the problem, and its effect on a maintainer. Do not report style preferences that a formatter or linter owns.

## What to check

1. **Ownership.** Each responsibility has one clear owner. The change fixes behavior where it lives and keeps the repository's existing module boundaries.
2. **Leaky abstraction.** Callers do not need to know an abstraction's internals. The change exposes no internal state, helper, or type that callers should not depend on.
3. **Over-abstraction.** No layer, option, interface, generic, or helper exists only for a future use. A single-use indirection must make the code clearer, not just move it.
4. **Simplicity.** The change is the simplest correct one for the task. Branches, state, and control flow are no more complex than the behavior needs.
5. **Reuse.** The change uses existing local code, the standard library, and installed dependencies before bespoke code. It does not reimplement something the repository already has.
6. **Extensibility.** The change extends existing seams so the next similar change is easy. Extensibility never means speculative hooks or configuration; treat those as over-abstraction.
7. **Overlap.** The change adds no logic that duplicates other logic, and no two new pieces do the same job.
8. **Dead code.** The change leaves no unused function, branch, parameter, export, import, or file.
9. **Test value.** Each added or changed test protects observable behavior that existing tests miss. Flag tests that duplicate another test's proof, assert implementation details, cannot fail for a credible regression, or no longer run.
10. **Coverage.** The added behavior, including its edge cases and error paths, has meaningful tests at the owning boundary.

## Severity

- **High:** a maintainer would have to rework the design, such as a broken ownership boundary or a leaked abstraction that callers now depend on.
- **Medium:** a maintainer would have to clean up before building on the code, such as dead code, a duplicated test, or a needless layer.
- **Low:** a local improvement that does not block further work.
