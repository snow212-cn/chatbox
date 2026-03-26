import { app } from 'electron'
import * as fs from 'fs-extra'
import path from 'path'

const appDataPath = app.getPath('appData')
const preferredSharedUserDataPath = path.resolve(appDataPath, 'xyz.chatboxapp.app')

function resolveSharedUserDataPath() {
  return preferredSharedUserDataPath
}

export const sharedUserDataPath = resolveSharedUserDataPath()
app.setPath('userData', sharedUserDataPath)
app.setPath('sessionData', sharedUserDataPath)
fs.ensureDirSync(sharedUserDataPath)
