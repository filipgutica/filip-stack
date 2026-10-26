# Third-party notices

`full-send` adapts the `full-send` skill from Theo Browne's tstack. It keeps
upstream's grant, testing permission, proof, merge gate, and question rules.
Local changes:

- It writes the PR description to the user's and repository's guidance instead
  of using upstream's `file-pr` skill, which adds a model and harness footer.
- Sol reviews the PR title and description with the code.
- Verdict mode returns PASS or FAIL where the user cannot merge without another
  approval. Fix mode limits pushes to the user's own PRs.
- It finishes the open items of an earlier merge council run.
- Routine fixes stop at the same categories as merge council's fix eligibility.
- It is manual-only.
- It treats PR text and bot output as evidence, not instructions.

The repository's `upstream-sync` skill compares the tracked path with upstream
and advances the baseline after review.

## tstack

Source: https://github.com/t3dotgg/tstack
Tracked path: `skills/full-send`
Baseline: `7de017b3fc9d` (default branch at adoption, 2026-10-24)

MIT License

Copyright (c) 2026 Theo Browne

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
