import { describe, expect, it } from 'vitest'
import {
  normalizeWindowsMarkdownLinks,
  toLocalPathForShellOpen,
  toOpenableLocalFileUrl,
} from './local-links'

describe('normalizeWindowsMarkdownLinks', () => {
  it('normalizes backslashes in markdown link destinations', () => {
    expect(normalizeWindowsMarkdownLinks('[settings](D:\\Users\\me\\.vscode\\settings.json)')).toBe(
      '[settings](D:/Users/me/.vscode/settings.json)'
    )
  })

  it('does not touch fenced code blocks', () => {
    const input = [
      '```md',
      '[settings](D:\\Users\\me\\.vscode\\settings.json)',
      '```',
      '',
      '[real](D:\\Users\\me\\notes.md)',
    ].join('\n')

    expect(normalizeWindowsMarkdownLinks(input)).toBe(
      ['```md', '[settings](D:\\Users\\me\\.vscode\\settings.json)', '```', '', '[real](D:/Users/me/notes.md)'].join(
        '\n'
      )
    )
  })
})

describe('toOpenableLocalFileUrl', () => {
  it('converts a windows drive path to a file url', () => {
    expect(toOpenableLocalFileUrl('D:/Users/me/.vscode/settings.json')).toBe(
      'file:///D:/Users/me/.vscode/settings.json'
    )
  })

  it('converts an encoded windows path to a file url', () => {
    expect(toOpenableLocalFileUrl('D:%5CUsers%5Cme%5Cnotes%20today.md')).toBe(
      'file:///D:/Users/me/notes%20today.md'
    )
  })

  it('keeps unc paths openable', () => {
    expect(toOpenableLocalFileUrl('\\\\server\\share\\Folder Name\\file.txt')).toBe(
      'file://server/share/Folder%20Name/file.txt'
    )
  })
})

describe('toLocalPathForShellOpen', () => {
  it('decodes file urls back to local shell paths', () => {
    expect(toLocalPathForShellOpen('file:///D:/Users/me/.vscode/settings.json')).toBe(
      'D:\\Users\\me\\.vscode\\settings.json'
    )
  })

  it('decodes encoded raw windows paths', () => {
    expect(toLocalPathForShellOpen('D:%5CUsers%5Cme%5Cnotes%20today.md')).toBe('D:\\Users\\me\\notes today.md')
  })
})
