import { createRequire } from 'node:module'

import { marked, type MarkedExtension } from 'marked'

type MarkedTerminalFactory = (
  options?: {
    reflowText?: boolean
    width?: number
  },
) => MarkedExtension

const require = createRequire(import.meta.url)
const { markedTerminal } = require('marked-terminal') as {
  markedTerminal: MarkedTerminalFactory
}

marked.use(
  markedTerminal({
    reflowText: true,
    width: 100,
  }),
)

export const renderMarkdown = (markdown: string) =>
  marked(markdown, {
    gfm: true,
  }) as string
