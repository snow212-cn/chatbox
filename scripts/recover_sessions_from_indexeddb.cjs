const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const fsp = require('fs/promises')
const http = require('http')
const os = require('os')
const path = require('path')

const APP_ID = 'xyz.chatboxapp.app'
const DB_NAME = 'chatboxstore'
const HTTP_ORIGIN = 'http://localhost:1212'
const USER_DATA_OVERRIDE = process.env.CHATBOX_RECOVERY_USER_DATA || ''
const ORIGIN_TIMEOUT_MS = Number(process.env.CHATBOX_RECOVERY_TIMEOUT_MS || 20000)
const LOCALFORAGE_ENTRY = require.resolve('localforage')

const mode = process.argv[2] || 'inspect'

const appDataPath = app.getPath('appData')
const sharedUserDataPath = USER_DATA_OVERRIDE
  ? path.resolve(USER_DATA_OVERRIDE)
  : path.resolve(appDataPath, APP_ID)
const workDir = path.join(sharedUserDataPath, 'recovery-work')
const httpDumpPath = path.join(workDir, 'dump-http.json')
const fileDumpPath = path.join(workDir, 'dump-file.json')
const mergedPath = path.join(workDir, 'merged-sessions.json')
const reportPath = path.join(workDir, 'recovery-report.json')
const fileProbePath = path.join(workDir, 'probe-file-origin.html')

app.setPath('userData', sharedUserDataPath)
app.setPath('sessionData', sharedUserDataPath)

let server = null

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    default:
      return 'text/plain; charset=utf-8'
  }
}

async function ensureWorkFiles() {
  await fsp.mkdir(workDir, { recursive: true })
  await fsp.writeFile(
    fileProbePath,
    '<!doctype html><html><head><meta charset="utf-8"><title>probe-file-origin</title></head><body>probe</body></html>',
    'utf8'
  )
}

async function startHttpServer() {
  if (server) {
    return
  }

  server = http.createServer((req, res) => {
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>probe-http-origin</title></head><body>probe</body></html>'
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(1212, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
}

async function stopHttpServer() {
  if (!server) {
    return
  }
  await new Promise((resolve) => server.close(resolve))
  server = null
}

async function createWindow() {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  })
  return win
}

function withTimeout(promise, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ORIGIN_TIMEOUT_MS}ms`))
    }, ORIGIN_TIMEOUT_MS)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function escapeForTemplate(value) {
  return JSON.stringify(value)
}

async function dumpOrigin(win, { target, outputPath, originLabel }) {
  try {
    if (target === 'http') {
      await startHttpServer()
      await withTimeout(win.loadURL(HTTP_ORIGIN), `${originLabel} loadURL`)
    } else {
      await withTimeout(win.loadFile(fileProbePath), `${originLabel} loadFile`)
    }

    const expression = `
    (async () => {
      const fs = require('fs')
      const localforageModule = require(${escapeForTemplate(LOCALFORAGE_ENTRY)})
      const localforage = localforageModule.default || localforageModule
      const outputPath = ${escapeForTemplate(outputPath)}
      const dbName = ${escapeForTemplate(DB_NAME)}
      const originLabel = ${escapeForTemplate(originLabel)}

      function readViaIndexedDb() {
        return new Promise((resolve) => {
          const openReq = indexedDB.open(dbName)
          openReq.onerror = () => resolve({ exists: false, error: String(openReq.error || 'open-error'), entries: [] })
          openReq.onsuccess = () => {
            const db = openReq.result
            const storeNames = Array.from(db.objectStoreNames)
            if (storeNames.length === 0) {
              db.close()
              resolve({ exists: true, storeNames, entries: [] })
              return
            }
            const storeName = storeNames[0]
            const tx = db.transaction([storeName], 'readonly')
            const store = tx.objectStore(storeName)
            const entries = []
            const cursorReq = store.openCursor()

            cursorReq.onerror = () => {
              db.close()
              resolve({
                exists: entries.length > 0,
                storeNames,
                storeName,
                entries,
                error: String(cursorReq.error || 'cursor-error'),
              })
            }

            cursorReq.onsuccess = (event) => {
              const cursor = event.target.result
              if (!cursor) {
                db.close()
                resolve({
                  exists: entries.length > 0,
                  storeNames,
                  storeName,
                  entries,
                })
                return
              }

              try {
                entries.push({ key: cursor.key, value: cursor.value })
              } catch (error) {
                db.close()
                resolve({
                  exists: entries.length > 0,
                  storeNames,
                  storeName,
                  entries,
                  error: String(error),
                })
                return
              }

              cursor.continue()
            }
          }
        })
      }

      async function readDatabase() {
        const store = localforage.createInstance({ name: dbName })
        try {
          const keys = await store.keys()
          const entries = []
          for (const key of keys) {
            entries.push({ key, value: await store.getItem(key) })
          }
          return {
            exists: keys.length > 0,
            storeNames: ['keyvaluepairs'],
            storeName: 'keyvaluepairs',
            entries,
          }
        } catch (error) {
          const fallback = await readViaIndexedDb()
          return {
            ...fallback,
            localforageError: String(error),
          }
        }
      }

      const dbDump = await readDatabase()
      const out = {
        originLabel,
        href: location.href,
        origin: location.origin,
        dbName,
        ...dbDump,
      }

      fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8')
      return {
        originLabel,
        href: out.href,
        origin: out.origin,
        exists: out.exists,
        entryCount: Array.isArray(out.entries) ? out.entries.length : 0,
      }
    })()
  `

    return await withTimeout(win.webContents.executeJavaScript(expression), `${originLabel} executeJavaScript`)
  } catch (error) {
    const out = {
      originLabel,
      href: win.webContents.getURL(),
      origin: target === 'http' ? HTTP_ORIGIN : 'file://',
      dbName: DB_NAME,
      exists: false,
      entries: [],
      error: String(error),
    }
    await fsp.writeFile(outputPath, JSON.stringify(out, null, 2), 'utf8')
    return {
      originLabel,
      href: out.href,
      origin: out.origin,
      exists: false,
      entryCount: 0,
      error: out.error,
    }
  }
}

function safeJsonParse(value) {
  if (typeof value !== 'string') {
    return null
  }
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function collectMessageTimestamps(messages, acc) {
  if (!Array.isArray(messages)) {
    return
  }
  for (const message of messages) {
    if (message && typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)) {
      acc.push(message.timestamp)
    }
  }
}

function computeSessionStats(session) {
  const timestamps = []
  collectMessageTimestamps(session.messages, timestamps)
  if (Array.isArray(session.threads)) {
    for (const thread of session.threads) {
      collectMessageTimestamps(thread?.messages, timestamps)
    }
  }

  const rootMessages = Array.isArray(session.messages) ? session.messages.length : 0
  const threadMessages = Array.isArray(session.threads)
    ? session.threads.reduce((sum, thread) => sum + (Array.isArray(thread?.messages) ? thread.messages.length : 0), 0)
    : 0

  return {
    rootMessages,
    threadMessages,
    totalMessages: rootMessages + threadMessages,
    latestTimestamp: timestamps.length ? Math.max(...timestamps) : 0,
    earliestTimestamp: timestamps.length ? Math.min(...timestamps) : 0,
  }
}

function sessionMetaFromSession(session) {
  return {
    id: session.id,
    name: session.name,
    starred: session.starred,
    assistantAvatarKey: session.assistantAvatarKey,
    picUrl: session.picUrl,
    type: session.type,
  }
}

function chooseBetterCandidate(left, right) {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }

  const leftStats = left.stats
  const rightStats = right.stats

  if (rightStats.totalMessages !== leftStats.totalMessages) {
    return rightStats.totalMessages > leftStats.totalMessages ? right : left
  }
  if (rightStats.latestTimestamp !== leftStats.latestTimestamp) {
    return rightStats.latestTimestamp > leftStats.latestTimestamp ? right : left
  }
  if (right.raw.length !== left.raw.length) {
    return right.raw.length > left.raw.length ? right : left
  }
  if (right.originLabel === 'http-live' && left.originLabel !== 'http-live') {
    return right
  }
  return left
}

function normalizeDump(rawDump) {
  const parsed = JSON.parse(rawDump)
  const entries = Array.isArray(parsed.entries) ? parsed.entries : []
  const sessionList = safeJsonParse(entries.find((entry) => entry.key === 'chat-sessions-list')?.value) || []
  const sessions = new Map()

  for (const entry of entries) {
    if (typeof entry.key !== 'string' || !entry.key.startsWith('session:')) {
      continue
    }
    const session = safeJsonParse(entry.value)
    if (!session || !session.id) {
      continue
    }
    sessions.set(session.id, {
      key: entry.key,
      raw: entry.value,
      parsed: session,
      stats: computeSessionStats(session),
      originLabel: parsed.originLabel,
    })
  }

  return {
    originLabel: parsed.originLabel,
    href: parsed.href,
    origin: parsed.origin,
    entryCount: entries.length,
    sessionList,
    sessions,
  }
}

function mergeDumps(dumps) {
  const mergedSessions = new Map()
  const orderedIds = []
  const seenOrderedIds = new Set()

  for (const dump of dumps) {
    for (const meta of dump.sessionList) {
      if (!meta?.id || seenOrderedIds.has(meta.id)) {
        continue
      }
      seenOrderedIds.add(meta.id)
      orderedIds.push(meta.id)
    }

    for (const [sessionId, candidate] of dump.sessions) {
      mergedSessions.set(sessionId, chooseBetterCandidate(mergedSessions.get(sessionId), candidate))
    }
  }

  const orphanIds = Array.from(mergedSessions.keys())
    .filter((sessionId) => !seenOrderedIds.has(sessionId))
    .sort((leftId, rightId) => {
      const left = mergedSessions.get(leftId)
      const right = mergedSessions.get(rightId)
      if (left.stats.earliestTimestamp !== right.stats.earliestTimestamp) {
        return left.stats.earliestTimestamp - right.stats.earliestTimestamp
      }
      return leftId.localeCompare(rightId)
    })

  const finalIds = orderedIds.concat(orphanIds)
  const finalSessionList = finalIds
    .map((sessionId) => mergedSessions.get(sessionId)?.parsed)
    .filter(Boolean)
    .map(sessionMetaFromSession)

  return {
    finalIds,
    finalSessionList,
    mergedSessions,
  }
}

async function writeMergedImportFile(merged) {
  const payload = {
    generatedAt: new Date().toISOString(),
    sessionList: merged.finalSessionList,
    sessions: merged.finalIds.map((sessionId) => {
      const candidate = merged.mergedSessions.get(sessionId)
      return {
        key: `session:${sessionId}`,
        raw: candidate.raw,
        originLabel: candidate.originLabel,
        stats: candidate.stats,
      }
    }),
  }

  await fsp.writeFile(mergedPath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

async function importMergedData(win) {
  await startHttpServer()
  await win.loadURL(HTTP_ORIGIN)

  const expression = `
    (async () => {
      const fs = require('fs')
      const localforageModule = require('localforage')
      const localforage = localforageModule.default || localforageModule
      const inputPath = ${escapeForTemplate(mergedPath)}
      const dbName = ${escapeForTemplate(DB_NAME)}
      const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
      const store = localforage.createInstance({ name: dbName })

      for (const session of payload.sessions) {
        await store.setItem(session.key, session.raw)
      }
      await store.setItem('chat-sessions-list', JSON.stringify(payload.sessionList))

      return {
        importedSessionCount: payload.sessions.length,
        importedListCount: payload.sessionList.length,
      }
    })()
  `

  return await win.webContents.executeJavaScript(expression)
}

async function buildSummary() {
  const rawHttpDump = await fsp.readFile(httpDumpPath, 'utf8')
  const rawFileDump = await fsp.readFile(fileDumpPath, 'utf8')
  const httpDump = normalizeDump(rawHttpDump)
  const fileDump = normalizeDump(rawFileDump)
  const merged = mergeDumps([httpDump, fileDump])
  const mergedPayload = await writeMergedImportFile(merged)

  const summary = {
    generatedAt: new Date().toISOString(),
    userDataPath: sharedUserDataPath,
    dumps: {
      http: {
        originLabel: httpDump.originLabel,
        href: httpDump.href,
        entryCount: httpDump.entryCount,
        sessionListCount: httpDump.sessionList.length,
        sessionKeyCount: httpDump.sessions.size,
      },
      file: {
        originLabel: fileDump.originLabel,
        href: fileDump.href,
        entryCount: fileDump.entryCount,
        sessionListCount: fileDump.sessionList.length,
        sessionKeyCount: fileDump.sessions.size,
      },
    },
    merged: {
      sessionCount: mergedPayload.sessions.length,
      sessionListCount: mergedPayload.sessionList.length,
      firstTenSessions: mergedPayload.sessionList.slice(0, 10).map((meta) => ({ id: meta.id, name: meta.name })),
    },
  }

  await fsp.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8')
  return { summary, merged }
}

async function main() {
  await ensureWorkFiles()

  const win = await createWindow()
  try {
    let httpResult = null
    let fileResult = null
    let summary = null

    const shouldInspectHttp = mode === 'inspect' || mode === 'recover' || mode === 'inspect-http'
    const shouldInspectFile = mode === 'inspect' || mode === 'recover' || mode === 'inspect-file'
    const shouldBuildSummary = mode === 'inspect' || mode === 'recover'

    if (shouldInspectHttp) {
      httpResult = await dumpOrigin(win, {
        target: 'http',
        outputPath: httpDumpPath,
        originLabel: 'http-live',
      })
    }

    if (shouldInspectFile) {
      fileResult = await dumpOrigin(win, {
        target: 'file',
        outputPath: fileDumpPath,
        originLabel: 'file-live',
      })
    }

    if (shouldBuildSummary) {
      ;({ summary } = await buildSummary())
    }

    if (mode === 'recover' || mode === 'import') {
      const importResult = await importMergedData(win)
      summary = {
        ...(summary ?? safeJsonParse(await fsp.readFile(reportPath, 'utf8')) ?? {}),
        import: importResult,
      }
      await fsp.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8')
    }

    console.log(JSON.stringify({ httpResult, fileResult, reportPath, summary }, null, 2))
  } finally {
    await stopHttpServer()
    if (!win.isDestroyed()) {
      win.destroy()
    }
    app.quit()
    setImmediate(() => process.exit(process.exitCode ?? 0))
  }
}

app.whenReady().then(main).catch(async (error) => {
  console.error(error)
  await stopHttpServer()
  app.quit()
  process.exit(1)
})
