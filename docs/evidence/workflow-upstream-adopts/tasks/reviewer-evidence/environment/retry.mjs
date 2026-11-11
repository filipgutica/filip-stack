export const retry = async (operation) => {
  try {
    return await operation()
  } catch {
    return operation()
  }
}
