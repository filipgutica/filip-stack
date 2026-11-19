# Third-party notices

`council` adapts the `council` skill from Theo Browne's tstack. The local
adaptation uses Sol 6.2, Opus 5.5, and Gemini 4 Neon at high effort by
default, with the current agent coordinating one round by default, and Fable
5.2 as an arbiter that rules when members recommend conflicting actions. The
request sets members, lenses, goal, and criteria, or a separate designer
agent frames them, never the coordinating agent. The designer can plan up to
three rounds, revising a drafted proposal between them. It retains
independent advice and synthesis. Members
review a proposal or artifact against the criteria and rank their findings by
severity, drafting a proposal first when the request has none, or answer an
open question with a recommendation and its uncertainties, in a written
report. Members give no score by default; scores, PR updates, per-round score
tables, and fix/review loops live in full-send's council gate. It adds Codex metadata and
keeps implementation authority separate from advice.

## tstack

Source: https://github.com/t3dotgg/tstack
Tracked path: `skills/council`
Baseline: `11e37a74d0a6868c121cd0910ab2b3bd9873b92a` (default branch, reviewed 2026-11-11)

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
