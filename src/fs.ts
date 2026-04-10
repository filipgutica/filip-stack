import { readFile } from 'node:fs/promises'

export const readOptionalFile = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, 'utf8')
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT') {
      return null
    }

    throw caughtError
  }
}
