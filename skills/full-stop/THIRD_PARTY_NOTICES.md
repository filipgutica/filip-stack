# Third-party notices

`full-stop` adapts the `full-stop` skill from Theo Browne's tstack. It keeps
upstream's no-merge rules, auto-merge and merge queue guard, and readiness
check at the full-send merge gate. Local changes:

- It is manual-only. Upstream starts whenever the user says "full stop", even
  as a closing "Full stop." used for emphasis.
- It gives the path to `full-send` as text instead of upstream's relative
  link. The skills CLI copies only the skill's directory, so this
  repository's validator rejects links outside it.
- It reuses this repository's `full-send` verdict mode. A PR that needs only a
  human approval reports `PASS: ready for human review`.
- In review-only mode, it reports auto-merge and merge queue settings on
  someone else's PR instead of changing them.

The repository's `upstream-sync` skill compares the tracked path with upstream
and advances the baseline after review.

## tstack

Source: https://github.com/t3dotgg/tstack
Tracked path: `skills/full-stop`
Baseline: `1085050f3bae` (default branch at adoption, 2026-10-28)

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
