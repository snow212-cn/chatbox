const WINDOWS_DRIVE_PATH_RE = /^[A-Za-z]:[\\/]/
const WINDOWS_UNC_PATH_RE = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function isFileUrl(value: string): boolean {
  return /^file:/i.test(value.trim())
}

export function isWindowsDrivePath(value: string): boolean {
  return WINDOWS_DRIVE_PATH_RE.test(value.trim())
}

export function isWindowsUncPath(value: string): boolean {
  return WINDOWS_UNC_PATH_RE.test(value.trim())
}

export function isLikelyWindowsLocalPath(value: string): boolean {
  const decoded = safeDecodeURIComponent(value.trim())
  return isWindowsDrivePath(decoded) || isWindowsUncPath(decoded)
}

export function isLikelyLocalFileLink(value: string): boolean {
  const trimmed = value.trim()
  return !!trimmed && (isFileUrl(trimmed) || isLikelyWindowsLocalPath(trimmed))
}

function encodePathSegments(pathname: string): string {
  return pathname
    .split('/')
    .map((segment, index) => {
      if (!segment) {
        return segment
      }
      if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
        return segment
      }
      return encodeURIComponent(segment)
    })
    .join('/')
}

function windowsPathToFileUrl(value: string): string {
  const normalized = safeDecodeURIComponent(value.trim()).replace(/\\/g, '/')

  if (isWindowsDrivePath(normalized)) {
    return `file:///${encodePathSegments(normalized)}`
  }

  if (isWindowsUncPath(normalized)) {
    const withoutPrefix = normalized.replace(/^\/+/, '')
    const [host, ...segments] = withoutPrefix.split('/')
    const encodedPath = segments.map((segment) => encodeURIComponent(segment)).join('/')
    return encodedPath ? `file://${host}/${encodedPath}` : `file://${host}`
  }

  return value.trim()
}

export function toOpenableLocalFileUrl(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return trimmed
  }

  if (isFileUrl(trimmed)) {
    const withoutScheme = trimmed.replace(/^file:/i, '')
    const normalizedCandidate = safeDecodeURIComponent(withoutScheme).replace(/^\/+(?=[A-Za-z]:[\\/])/, '')
    if (isWindowsDrivePath(normalizedCandidate) || isWindowsUncPath(normalizedCandidate)) {
      return windowsPathToFileUrl(normalizedCandidate)
    }
    return trimmed
  }

  if (isLikelyWindowsLocalPath(trimmed)) {
    return windowsPathToFileUrl(trimmed)
  }

  return trimmed
}

export function normalizeWindowsMarkdownLinks(markdown: string): string {
  if (
    markdown.indexOf('](') === -1 ||
    (markdown.indexOf(':\\') === -1 && markdown.indexOf('\\\\') === -1)
  ) {
    return markdown
  }

  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((block) =>
      block.slice(0, 3) === '```'
        ? block
        : block.replace(
            /(!?\[[^\]\n]*\]\()((?:[A-Za-z]:\\|\\\\)[^)\n]*)(\))/g,
            (_match, prefix, destination, suffix) => `${prefix}${destination.replace(/\\/g, '/')}${suffix}`
          )
    )
    .join('')
}

export function toLocalPathForShellOpen(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  let candidate = trimmed
  if (isFileUrl(trimmed)) {
    candidate = safeDecodeURIComponent(trimmed.replace(/^file:/i, '')).replace(/^\/+(?=[A-Za-z]:[\\/])/, '')
  } else {
    candidate = safeDecodeURIComponent(trimmed)
  }

  if (!isWindowsDrivePath(candidate) && !isWindowsUncPath(candidate)) {
    return null
  }

  return candidate.replace(/\//g, '\\')
}
