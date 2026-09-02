/** Use the host `__()` when Prospecting is globbed into the suite. Standalone = English. */
export function __(message, replace, context) {
  if (typeof window !== 'undefined' && typeof window.__ === 'function') {
    return window.__(message, replace, context)
  }
  if (replace == null) return message
  return String(message).replace(/{(\d+)}/g, (match, number) =>
    typeof replace[number] != 'undefined' ? replace[number] : match,
  )
}
