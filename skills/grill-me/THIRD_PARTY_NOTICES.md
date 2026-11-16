# Third-party notices

`grill-me` adapts the `grill-me` skill from Matt Pocock's public skills.
Upstream `grill-me` runs the `grilling` skill, so the tracked path is
`grilling`. The local adaptation asks one question at a time instead of
upstream's rounds of numbered questions, and looks up facts itself instead of
starting subagents.

The repository's `upstream-sync` skill compares the tracked path with upstream
and advances the baseline after review.

## Matt Pocock skills

Source: https://github.com/mattpocock/skills
Tracked path: `skills/productivity/grilling`
Baseline: `5863806dd4e1` (default branch, reviewed 2026-11-16)

MIT License

Copyright (c) 2026 Matt Pocock

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
