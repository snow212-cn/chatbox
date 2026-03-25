/**
 * This module contains all fundamental operations for chat sessions and messages.
 * It uses react-query for caching.
 * */

import {
  type Message,
  type Session,
  type SessionMeta,
  type SessionSettings,
  SessionSettingsSchema,
  type Updater,
  type UpdaterFn,
} from '@shared/types'
import { getFirstVisibleMessage, hasMeaningfulMessageContent } from '@shared/utils/message'
import { useQuery } from '@tanstack/react-query'
import compact from 'lodash/compact'
import isEmpty from 'lodash/isEmpty'
import { useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import storage, { StorageKey } from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as defaults from '../../shared/defaults'
import { getLogger } from '../lib/utils'
import { migrateSession, sortSessions } from '../utils/session-utils'
import { uiStore } from './uiStore'

const log = getLogger('chat-store')

import { clearScrollPositionCache } from '@/components/chat/MessageList'
import { cleanupSessionAtomCache } from './atoms/throttleWriteSessionAtom'
import { lastUsedModelStore } from './lastUsedModelStore'
import queryClient from './queryClient'
import { getSessionMeta } from './sessionHelpers'
import { settingsStore, useSettingsStore } from './settingsStore'
import { UpdateQueue } from './updateQueue'

const QueryKeys = {
  ChatSessionsList: ['chat-sessions-list'],
  ChatSession: (id: string) => ['chat-session', id],
}

// MARK: session list operations

// list sessions meta
async function _listSessionsMeta(): Promise<SessionMeta[]> {
  console.debug('chatStore', 'listSessionsMeta')
  try {
    const sessionMetaList = await storage.getItem<SessionMeta[]>(StorageKey.ChatSessionsList, [])
    // session list showing order: reversed, pinned at top
    return sessionMetaList
  } catch (error) {
    log.error(`Failed to read session list from storage (key: ${StorageKey.ChatSessionsList}):`, error)
    // Re-throw to prevent empty data from being written back
    throw error
  }
}

const listSessionsMetaQueryOptions = {
  queryKey: QueryKeys.ChatSessionsList,
  queryFn: () => _listSessionsMeta().then(sortSessions),
  staleTime: Infinity,
}

export async function listSessionsMeta() {
  return await queryClient.fetchQuery(listSessionsMetaQueryOptions)
}

export function useSessionList() {
  const { data: sessionMetaList, refetch } = useQuery({ ...listSessionsMetaQueryOptions })
  return { sessionMetaList, refetch }
}

let sessionListUpdateQueue: UpdateQueue<SessionMeta[]> | null = null

export async function updateSessionList(updater: UpdaterFn<SessionMeta[]>) {
  if (!sessionListUpdateQueue) {
    sessionListUpdateQueue = new UpdateQueue<SessionMeta[]>(
      () => _listSessionsMeta(),
      async (sessions) => {
        await storage.setItemNow(StorageKey.ChatSessionsList, sessions)
      }
    )
  }
  console.debug('chatStore', 'updateSessionList', updater)
  const result = await sessionListUpdateQueue.set(updater)
  queryClient.setQueryData(QueryKeys.ChatSessionsList, sortSessions(result))
}

// MARK: session operations

// get session
async function _getSessionById(id: string): Promise<Session | null> {
  console.debug('chatStore', 'getSessionById', id)
  const storageKey = StorageKeyGenerator.session(id)
  try {
    const session = await storage.getItem<Session | null>(storageKey, null)
    if (!session) {
      return null
    }
    return migrateSession(session)
  } catch (error) {
    log.error(`Failed to read session from storage (key: ${storageKey}, sessionId: ${id}):`, error)
    // Re-throw to prevent incorrect state
    throw error
  }
}

const getSessionQueryOptions = (sessionId: string) => ({
  queryKey: QueryKeys.ChatSession(sessionId),
  queryFn: () => _getSessionById(sessionId),
  staleTime: Infinity,
})

export async function getSession(sessionId: string) {
  return await queryClient.fetchQuery(getSessionQueryOptions(sessionId))
}

export function useSession(sessionId: string | null) {
  const { data: session, ...rest } = useQuery({
    ...getSessionQueryOptions(sessionId!),
    enabled: !!sessionId,
  })
  return { session, ...rest }
}

function _setSessionCache(sessionId: string, updated: Session | null) {
  // 1. update session cache 2. session settings do not use cache now
  queryClient.setQueryData(QueryKeys.ChatSession(sessionId), updated)
}

// create session
export async function createSession(newSession: Omit<Session, 'id'>, previousId?: string) {
  console.debug('chatStore', 'createSession', newSession)
  const { chat: lastUsedChatModel, picture: lastUsedPictureModel } = lastUsedModelStore.getState()
  const session = {
    ...newSession,
    id: uuidv4(),
    settings: {
      ...(newSession.type === 'picture' ? lastUsedPictureModel : lastUsedChatModel),
      ...newSession.settings,
    },
  }
  await storage.setItemNow(StorageKeyGenerator.session(session.id), session)
  const sMeta = getSessionMeta(session)
  await updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    if (previousId) {
      let previouseSessionIndex = sessions.findIndex((s) => s.id === previousId)
      if (previouseSessionIndex < 0) {
        previouseSessionIndex = sessions.length - 1
      }
      return [...sessions.slice(0, previouseSessionIndex + 1), sMeta, ...sessions.slice(previouseSessionIndex + 1)]
    }
    return [...sessions, sMeta]
  })
  return session
}

const sessionUpdateQueues: Record<string, UpdateQueue<Session>> = {}

export async function updateSessionWithMessages(sessionId: string, updater: Updater<Session>) {
  console.debug('chatStore', 'updateSession', sessionId, updater)
  if (!sessionUpdateQueues[sessionId]) {
    // do not use await here to avoid data race
    sessionUpdateQueues[sessionId] = new UpdateQueue<Session>(
      () => getSession(sessionId),
      async (session) => {
        if (session) {
          console.debug('chatStore', 'persist session', sessionId)
          await storage.setItemNow(StorageKeyGenerator.session(sessionId), session)
        }
      }
    )
  }
  let needUpdateSessionList = true
  const updated = await sessionUpdateQueues[sessionId].set((prev) => {
    if (!prev) {
      throw new Error(`Session ${sessionId} not found`)
    }
    if (typeof updater === 'function') {
      return updater(prev)
    } else {
      if (isEmpty(getSessionMeta(updater as SessionMeta))) {
        needUpdateSessionList = false
      }
      return { ...prev, ...updater }
    }
  })
  if (needUpdateSessionList) {
    await updateSessionList((sessions) => {
      if (!sessions) {
        throw new Error('Session list not found')
      }
      return sessions.map((session) => (session.id === sessionId ? getSessionMeta(updated) : session))
    })
  }
  _setSessionCache(sessionId, updated)
  return updated
}

// 这里只能修改messages之外的字段
export async function updateSession(sessionId: string, updater: Updater<Omit<Session, 'messages'>>) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    const updated = typeof updater === 'function' ? updater(session) : updater
    return {
      ...session,
      ...updated,
    }
  })
}

// only update session cache without touching storage, for performance sensitive usage
export async function updateSessionCache(sessionId: string, updater: Updater<Session>) {
  console.debug('chatStore', 'updateSessionCache', sessionId, updater)
  const session = await getSession(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }
  queryClient.setQueryData(QueryKeys.ChatSession(sessionId), (old: Session | undefined | null) => {
    if (!old) {
      return old
    }
    if (typeof updater === 'function') {
      return updater(old)
    } else {
      return { ...old, ...updater }
    }
  })
}

export async function deleteSession(id: string) {
  console.debug('chatStore', 'deleteSession', id)
  await storage.removeItem(StorageKeyGenerator.session(id))
  _setSessionCache(id, null)
  await updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    return sessions.filter((session) => session.id !== id)
  })
  // Clean up UI state and caches to prevent memory leaks
  uiStore.getState().clearSessionWebBrowsing(id)
  uiStore.getState().removeSessionKnowledgeBase(id)
  cleanupSessionAtomCache(id)
  clearScrollPositionCache(id)
  delete sessionUpdateQueues[id]
}

// MARK: session settings operations

function mergeDefaultSessionSettings(session: Session): SessionSettings {
  if (session.type === 'picture') {
    return SessionSettingsSchema.parse({
      ...defaults.pictureSessionSettings(),
      ...session.settings,
    })
  } else {
    return SessionSettingsSchema.parse({
      ...defaults.chatSessionSettings(),
      ...session.settings,
    })
  }
}
// session settings is copied from global settings when session is created, so no need to merge global settings here
export function useSessionSettings(sessionId: string | null) {
  const { session } = useSession(sessionId)
  const globalSettings = useSettingsStore((state) => state)

  const sessionSettings = useMemo(() => {
    if (!session) {
      return SessionSettingsSchema.parse(globalSettings)
    }
    return mergeDefaultSessionSettings(session)
  }, [session, globalSettings])

  return { sessionSettings }
}

export async function getSessionSettings(sessionId: string) {
  const session = await getSession(sessionId)
  if (!session) {
    const globalSettings = settingsStore.getState().getSettings()
    return SessionSettingsSchema.parse(globalSettings)
  }
  return mergeDefaultSessionSettings(session)
}

// MARK: message operations

// list messages
export async function listMessages(sessionId?: string | null): Promise<Message[]> {
  console.debug('chatStore', 'listMessages', sessionId)
  if (!sessionId) {
    return []
  }
  const session = await getSession(sessionId)
  if (!session) {
    return []
  }
  return session.messages
}

export async function insertMessage(sessionId: string, message: Message, previousId?: string) {
  await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    if (previousId) {
      // try to find insert position in message list
      let previousIndex = session.messages.findIndex((m) => m.id === previousId)

      if (previousIndex >= 0) {
        return {
          ...session,
          messages: [
            ...session.messages.slice(0, previousIndex + 1),
            message,
            ...session.messages.slice(previousIndex + 1),
          ],
        } satisfies Session
      }

      // try to find insert position in threads
      if (session.threads) {
        for (const thread of session.threads) {
          previousIndex = thread.messages.findIndex((m) => m.id === previousId)
          if (previousIndex >= 0) {
            return {
              ...session,
              threads: session.threads.map((th) => {
                if (th.id === thread.id) {
                  return {
                    ...thread,
                    messages: [
                      ...thread.messages.slice(0, previousIndex + 1),
                      message,
                      ...thread.messages.slice(previousIndex + 1),
                    ],
                  }
                }
                return th
              }),
            } satisfies Session
          }
        }
      }
    }
    // no previous message, insert to tail of current thread
    return {
      ...session,
      messages: [...session.messages, message],
    } satisfies Session
  })
}

export async function updateMessageCache(sessionId: string, messageId: string, updater: Updater<Message>) {
  return await updateMessage(sessionId, messageId, updater, true)
}

export async function updateMessages(sessionId: string, updater: Updater<Message[]>) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }
    const updated = compact(typeof updater === 'function' ? updater(session.messages) : updater)
    return {
      ...session,
      messages: updated,
    }
  })
}

export async function updateMessage(
  sessionId: string,
  messageId: string,
  updater: Updater<Message>,
  onlyUpdateCache?: boolean
) {
  const updateFn = onlyUpdateCache ? updateSessionCache : updateSessionWithMessages

  await updateFn(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    const updateMessages = (messages: Message[]) => {
      return messages.map((m) => {
        if (m.id !== messageId) {
          return m
        }
        const updated = typeof updater === 'function' ? updater(m) : updater
        return {
          ...m,
          ...updated,
        } satisfies Message
      })
    }
    const message = session.messages.find((m) => m.id === messageId)
    if (message) {
      return {
        ...session,
        messages: updateMessages(session.messages),
      }
    }

    // try find message in threads
    if (session.threads) {
      for (const thread of session.threads) {
        const message = thread.messages.find((m) => m.id === messageId)
        if (message) {
          return {
            ...session,
            threads: session.threads.map((th) => {
              if (th.id !== thread.id) {
                return th
              }
              return {
                ...th,
                messages: updateMessages(th.messages),
              }
            }),
          } satisfies Session
        }
      }
    }

    return session
  })
}

export async function removeMessage(sessionId: string, messageId: string) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    const messageToDelete = session.messages.find((m) => m.id === messageId)
    const isSummaryMessage = messageToDelete?.isSummary === true

    const newMessages = session.messages.filter((m) => m.id !== messageId)
    const newThreads = session.threads?.map((thread) => ({
      ...thread,
      messages: thread.messages.filter((m) => m.id !== messageId),
      compactionPoints: isSummaryMessage
        ? thread.compactionPoints?.filter((cp) => cp.summaryMessageId !== messageId)
        : thread.compactionPoints,
    }))

    const newCompactionPoints = isSummaryMessage
      ? session.compactionPoints?.filter((cp) => cp.summaryMessageId !== messageId)
      : session.compactionPoints

    // Clean up empty fork branches after message removal and auto-switch if needed
    const { messages: finalMessages, threads: finalThreads, messageForksHash: newMessageForksHash } =
      cleanupEmptyForkBranches(
      session.messageForksHash,
      newMessages,
      newThreads,
      messageId
    )

    return {
      ...session,
      messages: finalMessages,
      threads: finalThreads,
      messageForksHash: newMessageForksHash,
      compactionPoints: newCompactionPoints,
    }
  })
}

/**
 * Clean up empty fork branches after message removal.
 * If the current branch (messages after forkMessageId) is empty, remove it from the fork
 * and automatically switch to another branch by loading its messages.
 */
function cleanupEmptyForkBranches(
  messageForksHash: Session['messageForksHash'],
  messages: Message[],
  threads: Session['threads'],
  removedMessageId?: string
): { messages: Message[]; threads: Session['threads']; messageForksHash: Session['messageForksHash'] } {
  if (!messageForksHash) {
    return { messages, threads, messageForksHash }
  }

  let resultHash: Session['messageForksHash'] = messageForksHash
  let resultMessages = messages
  let resultThreads = threads
  // A branch is only meaningful for navigation when it still has assistant
  // output with visible content. If it only keeps user-side messages or empty
  // assistant placeholders, we treat it as empty and collapse it.
  const hasAssistantOutput = (branchMessages: Message[]) =>
    branchMessages.some((msg) => msg.role === 'assistant' && hasMeaningfulMessageContent(msg))

  const removeForkEntry = (forkMessageId: string) => {
    const { [forkMessageId]: _removed, ...rest } = resultHash ?? {}
    resultHash = Object.keys(rest).length ? rest : undefined
  }

  const applyForkEntry = (forkMessageId: string, entry: NonNullable<Session['messageForksHash']>[string]) => {
    resultHash = {
      ...(resultHash ?? {}),
      [forkMessageId]: entry,
    }
  }

  for (const [forkMessageId, originalForkEntry] of Object.entries(messageForksHash)) {
    const nextEntry = resultHash?.[forkMessageId] ?? originalForkEntry
    const forkEntry = removedMessageId
      ? {
          ...nextEntry,
          lists: nextEntry.lists.map((list) => ({
            ...list,
            messages: list.messages.filter((msg) => msg.id !== removedMessageId),
          })),
        }
      : nextEntry

    if (!forkEntry) {
      continue
    }

    const rootIndex = resultMessages.findIndex((m) => m.id === forkMessageId)
    const rootContainer = rootIndex >= 0

    const threadIndex = rootContainer
      ? -1
      : (resultThreads?.findIndex((thread) => thread.messages.some((m) => m.id === forkMessageId)) ?? -1)

    if (!rootContainer && threadIndex < 0) {
      // Stale fork entry: fork point no longer exists
      removeForkEntry(forkMessageId)
      continue
    }

    const containerMessages = rootContainer ? resultMessages : (resultThreads?.[threadIndex]?.messages ?? [])
    const forkIndex = rootContainer
      ? rootIndex
      : containerMessages.findIndex((m) => m.id === forkMessageId)
    if (forkIndex < 0) {
      removeForkEntry(forkMessageId)
      continue
    }

    const currentTail = containerMessages.slice(forkIndex + 1)
    const currentBranchIsEmpty = !hasAssistantOutput(currentTail)

    const keptLists: NonNullable<Session['messageForksHash']>[string]['lists'] = []
    let mappedCurrentPosition = -1

    forkEntry.lists.forEach((list, index) => {
      if (index === forkEntry.position) {
        if (!currentBranchIsEmpty) {
          mappedCurrentPosition = keptLists.length
          keptLists.push({
            ...list,
            messages: [],
          })
        }
        return
      }

      if (hasAssistantOutput(list.messages)) {
        keptLists.push(list)
      }
    })

    const prefix = containerMessages.slice(0, forkIndex + 1)

    // No branch left at all
    if (keptLists.length === 0) {
      if (rootContainer) {
        resultMessages = prefix
      } else if (resultThreads && threadIndex >= 0) {
        resultThreads = resultThreads.map((thread, idx) =>
          idx === threadIndex ? { ...thread, messages: prefix } : thread
        )
      }
      removeForkEntry(forkMessageId)
      continue
    }

    // Only one branch left -> no need to keep fork navigation
    if (keptLists.length === 1) {
      const remainingMessages = currentBranchIsEmpty ? keptLists[0].messages : currentTail
      if (rootContainer) {
        resultMessages = prefix.concat(remainingMessages)
      } else if (resultThreads && threadIndex >= 0) {
        resultThreads = resultThreads.map((thread, idx) =>
          idx === threadIndex ? { ...thread, messages: prefix.concat(remainingMessages) } : thread
        )
      }
      removeForkEntry(forkMessageId)
      continue
    }

    if (currentBranchIsEmpty) {
      const fallbackPosition = Math.min(forkEntry.position, keptLists.length - 1)
      const nextBranchMessages = keptLists[fallbackPosition]?.messages ?? []
      const normalizedLists = keptLists.map((list, index) =>
        index === fallbackPosition
          ? {
              ...list,
              messages: [],
            }
          : list
      )

      if (rootContainer) {
        resultMessages = prefix.concat(nextBranchMessages)
      } else if (resultThreads && threadIndex >= 0) {
        resultThreads = resultThreads.map((thread, idx) =>
          idx === threadIndex ? { ...thread, messages: prefix.concat(nextBranchMessages) } : thread
        )
      }

      applyForkEntry(forkMessageId, {
        ...forkEntry,
        position: fallbackPosition,
        lists: normalizedLists,
      })
      continue
    }

    const normalizedPosition = mappedCurrentPosition >= 0 ? mappedCurrentPosition : 0
    applyForkEntry(forkMessageId, {
      ...forkEntry,
      position: normalizedPosition,
      lists: keptLists.map((list, index) =>
        index === normalizedPosition
          ? {
              ...list,
              messages: [],
            }
          : list
      ),
    })
  }

  return { messages: resultMessages, threads: resultThreads, messageForksHash: resultHash }
}

// MARK: data recovery operations

/**
 * Recover session list by scanning all session: prefixed keys in storage
 * This will clear the current session list and rebuild it from all found sessions
 */
export async function recoverSessionList() {
  console.debug('chatStore', 'recoverSessionList')

  // Get all storage keys
  const allKeys = await storage.getAllKeys()

  // Filter keys that match the session: prefix
  const sessionKeys = allKeys.filter((key) => key.startsWith('session:'))

  // Fetch all sessions with their first message timestamp
  const sessionsWithTimestamp: Array<{ meta: SessionMeta; timestamp: number }> = []
  const failedKeys: string[] = []

  for (const key of sessionKeys) {
    try {
      const session = await storage.getItem<Session | null>(key, null)
      if (session) {
        const migratedSession = migrateSession(session)
        const firstMessageTimestamp = getFirstVisibleMessage(migratedSession.messages)?.timestamp || 0
        sessionsWithTimestamp.push({
          meta: getSessionMeta(migratedSession),
          timestamp: firstMessageTimestamp,
        })
      }
    } catch (error) {
      // Handle cases where IndexedDB fails to read large values
      // This can happen with "DataError: Failed to read large IndexedDB value" in some browsers
      console.error(`Failed to read session "${key}":`, error)
      failedKeys.push(key)
    }
  }

  if (failedKeys.length > 0) {
    console.warn(`chatStore: Failed to recover ${failedKeys.length} sessions due to read errors`)
  }

  // Sort by first message timestamp (older first)
  sessionsWithTimestamp.sort((a, b) => a.timestamp - b.timestamp)

  // Extract sorted session metas
  const recoveredSessionMetas = sessionsWithTimestamp.map((item) => item.meta)

  await storage.setItemNow(StorageKey.ChatSessionsList, recoveredSessionMetas)

  // Update the query cache, apply additional sorting rules (pinned sessions, etc.)
  queryClient.setQueryData(QueryKeys.ChatSessionsList, sortSessions(recoveredSessionMetas))

  console.debug(
    'chatStore',
    'recoverSessionList',
    `Recovered ${recoveredSessionMetas.length} sessions, ${failedKeys.length} failed`
  )

  return { recovered: recoveredSessionMetas.length, failed: failedKeys.length }
}
