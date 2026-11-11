// Parses the first JSON object in a model reply. A reply without valid JSON
// returns { invalid } so it counts as a failed attempt, not a run failure.
export const parseReply = (output) => {
  const content = String(output ?? '')
  try {
    return JSON.parse(content.match(/\{[\s\S]*\}/u)?.[0] ?? '')
  } catch {
    return { invalid: content.slice(0, 80) }
  }
}
