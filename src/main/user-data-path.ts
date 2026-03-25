import { app } from 'electron'
import * as fs from 'fs-extra'
import path from 'path'

const appDataPath = app.getPath('appData')
const preferredSharedUserDataPath = path.resolve(appDataPath, 'xyz.chatboxapp.app')
const fallbackUserDataCandidates = [
  path.resolve(appDataPath, 'Chatbox'),
  path.resolve(appDataPath, 'chatbox'),
  path.resolve(appDataPath, 'xyz.chatboxapp.ce'),
]

function hasExistingUserData(dirpath: string) {
  return (
    fs.existsSync(path.resolve(dirpath, 'config.json')) ||
    fs.existsSync(path.resolve(dirpath, 'databases')) ||
    fs.existsSync(path.resolve(dirpath, 'chatbox-blobs')) ||
    fs.existsSync(path.resolve(dirpath, 'IndexedDB')) ||
    fs.existsSync(path.resolve(dirpath, 'Local Storage')) ||
    fs.existsSync(path.resolve(dirpath, 'Session Storage'))
  )
}

function resolveSharedUserDataPath() {
  return preferredSharedUserDataPath
}

export const sharedUserDataPath = resolveSharedUserDataPath()

function countUtf16Occurrences(buffer: Buffer, value: string) {
  const needle = Buffer.from(value, 'utf16le')
  let count = 0
  let offset = 0

  while (offset < buffer.length) {
    const index = buffer.indexOf(needle, offset)
    if (index === -1) {
      break
    }
    count += 1
    offset = index + needle.length
  }

  return count
}

function countIndexedDbSessionMarkers(dirpath: string) {
  if (!fs.existsSync(dirpath)) {
    return 0
  }

  let total = 0
  for (const entry of fs.readdirSync(dirpath)) {
    const filepath = path.join(dirpath, entry)
    const stat = fs.statSync(filepath)
    if (!stat.isFile()) {
      continue
    }
    if (!entry.endsWith('.ldb') && !entry.endsWith('.log')) {
      continue
    }

    try {
      const content = fs.readFileSync(filepath)
      total += countUtf16Occurrences(content, 'session:')
    } catch (error) {
      console.warn(`[user-data-path] Failed to inspect IndexedDB file: ${filepath}`, error)
    }
  }

  return total
}

function migrateLegacyRendererOrigin(userDataPath: string) {
  const currentLevelDbPath = path.join(userDataPath, 'IndexedDB', 'file__0.indexeddb.leveldb')
  const currentBlobPath = path.join(userDataPath, 'IndexedDB', 'file__0.indexeddb.blob')
  const legacyLevelDbPath = path.join(userDataPath, 'IndexedDB', 'http_localhost_1212.indexeddb.leveldb')
  const legacyBlobPath = path.join(userDataPath, 'IndexedDB', 'http_localhost_1212.indexeddb.blob')

  if (!fs.existsSync(legacyLevelDbPath)) {
    return
  }

  const legacySessionCount = countIndexedDbSessionMarkers(legacyLevelDbPath)
  const currentSessionCount = countIndexedDbSessionMarkers(currentLevelDbPath)

  if (legacySessionCount <= currentSessionCount) {
    return
  }

  const backupSuffix = `backup-${Date.now()}`

  try {
    if (fs.existsSync(currentLevelDbPath)) {
      fs.moveSync(currentLevelDbPath, `${currentLevelDbPath}.${backupSuffix}`, { overwrite: true })
    }
    if (fs.existsSync(currentBlobPath)) {
      fs.moveSync(currentBlobPath, `${currentBlobPath}.${backupSuffix}`, { overwrite: true })
    }

    fs.copySync(legacyLevelDbPath, currentLevelDbPath, { overwrite: true })
    if (fs.existsSync(legacyBlobPath)) {
      fs.copySync(legacyBlobPath, currentBlobPath, { overwrite: true })
    }

    console.log(
      `[user-data-path] Migrated IndexedDB origin data from http_localhost_1212 to file__0 (legacy=${legacySessionCount}, current=${currentSessionCount})`
    )
  } catch (error) {
    console.error('[user-data-path] Failed to migrate IndexedDB origin data', error)
  }
}

// Force both Electron-managed app data and Chromium profile data to reuse the
// original Chatbox profile. Switching only userData is not sufficient because
// desktop session/chat data lives in IndexedDB under the Chromium profile.
migrateLegacyRendererOrigin(sharedUserDataPath)
app.setPath('userData', sharedUserDataPath)
app.setPath('sessionData', sharedUserDataPath)
fs.ensureDirSync(sharedUserDataPath)
