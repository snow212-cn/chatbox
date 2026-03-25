import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Message, Session, SessionThread } from '../../shared/types'

import * as sessionActions from './sessionActions'

const { uuidQueue, uuidv4Mock } = vi.hoisted(() => {
  const queue: string[] = []
  const mock = vi.fn(() => {
    if (queue.length === 0) {
      throw new Error('Mock uuid queue exhausted')
    }
    return queue.shift()!
  })
  return { uuidQueue: queue, uuidv4Mock: mock }
})

const { updateSessionWithMessages, insertMessageMock, useSessionMock, getSessionMock } = vi.hoisted(() => ({
  updateSessionWithMessages: vi.fn(),
  insertMessageMock: vi.fn(),
  useSessionMock: vi.fn(),
  getSessionMock: vi.fn(),
}))

vi.hoisted(() => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  }
  const windowMock: Record<string, unknown> = {
    electronAPI: undefined,
    localStorage: storage,
  }
  ;(globalThis as unknown as { window: Record<string, unknown>; localStorage: typeof storage }).window = windowMock
  ;(globalThis as unknown as { window: Record<string, unknown>; localStorage: typeof storage }).localStorage = storage
  const fakeRequire = Object.assign(
    () => {
      throw new Error('require is not implemented in tests')
    },
    {
      context: () => {
        const loader = () => ''
        loader.keys = () => [] as string[]
        return loader
      },
    }
  )
  ;(globalThis as unknown as { require: typeof fakeRequire }).require = fakeRequire
  return {}
})

vi.mock('uuid', () => ({
  v4: uuidv4Mock,
}))

vi.mock('./chatStore', () => ({
  updateSessionWithMessages,
  updateSession: vi.fn(),
  insertMessage: insertMessageMock,
  getSession: getSessionMock,
  useSession: useSessionMock,
}))

vi.mock('../platform', () => ({
  default: {
    type: 'web',
    getConfig: async () => ({}),
  },
}))

vi.mock('@/adapters', () => ({
  createModelDependencies: async () => ({}),
}))

vi.mock('@/packages/model-calls', () => ({
  generateImage: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

vi.mock('@/packages/model-setting-utils', () => ({
  getModelDisplayName: async () => 'mock-model',
}))

vi.mock('@/packages/token', () => ({
  estimateTokensFromMessages: () => 0,
}))

vi.mock('@/router', () => ({
  router: {
    navigate: vi.fn(),
  },
}))

vi.mock('@/utils/session-utils', () => ({
  sortSessions: (sessions: unknown) => sessions,
}))

vi.mock('@/utils/track', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/hooks/dom', () => ({
  focusMessageInput: vi.fn(),
}))

vi.mock('@/i18n/locales', () => ({
  languageNameMap: {},
}))

vi.mock('@/packages/apple_app_store', () => ({}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      getSettings: () => ({}),
    }),
  },
  useLanguage: () => 'en',
}))

vi.mock('@/stores/uiStore', () => ({
  uiStore: {
    getState: () => ({
      widthFull: false,
      messageScrolling: null,
      setMessageListElement: vi.fn(),
    }),
  },
  useUIStore: vi.fn(),
}))

vi.mock('@/components/settings/mcp/registries', () => ({
  MCP_ENTRIES_OFFICIAL: [],
}))

vi.mock('../components/settings/mcp/registries', () => ({
  MCP_ENTRIES_OFFICIAL: [],
}))

function makeMessage(id: string, role: Message['role'] = 'user'): Message {
  return {
    id,
    role,
    contentParts: [],
  }
}

function cloneSession(session: Session): Session {
  return JSON.parse(JSON.stringify(session)) as Session
}

beforeEach(() => {
  uuidQueue.length = 0
  uuidv4Mock.mockClear()
  updateSessionWithMessages.mockReset()
  insertMessageMock.mockReset()
  useSessionMock.mockReset()
  getSessionMock.mockReset()
})

describe('fork actions', () => {
  test('createNewFork moves trailing messages into a new branch', async () => {
    uuidQueue.push('id-1', 'id-2', 'id-3')
    const pivot = makeMessage('pivot', 'user')
    const trailing = makeMessage('trailing', 'assistant')
    const session: Session = {
      id: 'session-1',
      name: 'Test',
      messages: [pivot, trailing],
    }
    const snapshot = cloneSession(session)

    let updated: Session | undefined
    updateSessionWithMessages.mockImplementation(async (sessionId, updater) => {
      expect(sessionId).toBe(session.id)
      const result = updater(session)
      updated = result as Session
      return result
    })

    await sessionActions.createNewFork(session.id, pivot.id)

    expect(updateSessionWithMessages).toHaveBeenCalledTimes(1)
    expect(session).toEqual(snapshot)
    expect(updated).toBeDefined()
    expect(updated!.messages).toEqual([pivot])

    const fork = updated!.messageForksHash?.[pivot.id]
    expect(fork).toBeDefined()
    expect(fork!.position).toBe(1)
    expect(fork!.lists).toHaveLength(2)
    expect(fork!.lists[0].messages).toEqual([trailing])
    expect(fork!.lists[1].messages).toEqual([])
  })

  test('createNewFork skips update when no trailing messages', async () => {
    uuidQueue.push('id-1')
    const pivot = makeMessage('pivot', 'user')
    const session: Session = {
      id: 'session-2',
      name: 'Test',
      messages: [pivot],
    }
    const snapshot = cloneSession(session)
    let updated: Session | undefined

    updateSessionWithMessages.mockImplementation(async (sessionId, updater) => {
      expect(sessionId).toBe(session.id)
      const result = updater(session)
      updated = result as Session
      return result
    })

    await sessionActions.createNewFork(session.id, pivot.id)

    expect(updateSessionWithMessages).toHaveBeenCalledTimes(1)
    expect(session).toEqual(snapshot)
    expect(updated).toBe(session)
    expect(updated?.messageForksHash).toBeUndefined()
  })

  test('switchFork rotates branch contents for root messages', async () => {
    const pivot = makeMessage('pivot', 'user')
    const current = makeMessage('current', 'assistant')
    const alt = makeMessage('alt', 'assistant')
    const session: Session = {
      id: 'session-3',
      name: 'Test',
      messages: [pivot, current],
      messageForksHash: {
        [pivot.id]: {
          position: 0,
          lists: [
            { id: 'list-0', messages: [] },
            { id: 'list-1', messages: [alt] },
          ],
          createdAt: 1,
        },
      },
    }
    const snapshot = cloneSession(session)
    let updated: Session | undefined

    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      return result
    })

    await sessionActions.switchFork(session.id, pivot.id, 'next')

    expect(session).toEqual(snapshot)
    expect(updated).toBeDefined()
    expect(updated!.messages).toEqual([pivot, alt])

    const fork = updated!.messageForksHash?.[pivot.id]
    expect(fork).toBeDefined()
    expect(fork!.position).toBe(1)
    expect(fork!.lists[0].messages).toEqual([current])
    expect(fork!.lists[1].messages).toEqual([])
    expect(snapshot.messageForksHash?.[pivot.id].lists[0].messages).toEqual([])
  })

  test('switchFork updates forked thread messages', async () => {
    const pivot = makeMessage('pivot', 'user')
    const current = makeMessage('current', 'assistant')
    const alternative = makeMessage('alt', 'assistant')
    const thread: SessionThread = {
      id: 'thread-1',
      name: 'Thread',
      createdAt: 1,
      messages: [pivot, current],
    }
    const session: Session = {
      id: 'session-4',
      name: 'Test',
      messages: [],
      threads: [thread],
      messageForksHash: {
        [pivot.id]: {
          position: 0,
          lists: [
            { id: 'list-0', messages: [] },
            { id: 'list-1', messages: [alternative] },
          ],
          createdAt: 1,
        },
      },
    }
    const snapshot = cloneSession(session)
    let updated: Session | undefined

    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      return result
    })

    await sessionActions.switchFork(session.id, pivot.id, 'next')

    expect(session).toEqual(snapshot)
    expect(updated?.threads?.[0].messages).toEqual([pivot, alternative])
    const fork = updated?.messageForksHash?.[pivot.id]
    expect(fork?.position).toBe(1)
    expect(fork?.lists[0].messages).toEqual([current])
  })

  test('deleteFork promotes the next saved branch', async () => {
    const pivot = makeMessage('pivot', 'user')
    const current = makeMessage('current', 'assistant')
    const nextBranch = makeMessage('next', 'assistant')
    const session: Session = {
      id: 'session-5',
      name: 'Test',
      messages: [pivot, current],
      messageForksHash: {
        [pivot.id]: {
          position: 1,
          lists: [
            { id: 'list-0', messages: [nextBranch] },
            { id: 'list-1', messages: [] },
          ],
          createdAt: 1,
        },
      },
    }
    const snapshot = cloneSession(session)
    let updated: Session | undefined

    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      return result
    })

    await sessionActions.deleteFork(session.id, pivot.id)

    expect(session).toEqual(snapshot)
    expect(updated!.messages).toEqual([pivot, nextBranch])
    const fork = updated!.messageForksHash?.[pivot.id]
    expect(fork).toBeDefined()
    expect(fork!.position).toBe(0)
    expect(fork!.lists).toHaveLength(1)
    expect(fork!.lists[0].messages).toEqual([])
  })

  test('deleteFork removes entry when no branches remain', async () => {
    const pivot = makeMessage('pivot', 'user')
    const session: Session = {
      id: 'session-6',
      name: 'Test',
      messages: [pivot],
      messageForksHash: {
        [pivot.id]: {
          position: 0,
          lists: [{ id: 'list-0', messages: [] }],
          createdAt: 1,
        },
      },
    }
    const snapshot = cloneSession(session)
    let updated: Session | undefined

    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      return result
    })

    await sessionActions.deleteFork(session.id, pivot.id)

    expect(session).toEqual(snapshot)
    expect(updated!.messages).toEqual([pivot])
    expect(updated!.messageForksHash).toBeUndefined()
  })

  test('expandFork appends all stored branches and clears fork data', async () => {
    const pivot = makeMessage('pivot', 'user')
    const current = makeMessage('current', 'assistant')
    const altA = makeMessage('alt-a', 'assistant')
    const altB = makeMessage('alt-b', 'assistant')
    const session: Session = {
      id: 'session-7',
      name: 'Test',
      messages: [pivot, current],
      messageForksHash: {
        [pivot.id]: {
          position: 1,
          lists: [
            { id: 'list-0', messages: [altA] },
            { id: 'list-1', messages: [] },
            { id: 'list-2', messages: [altB] },
          ],
          createdAt: 1,
        },
      },
    }
    const snapshot = cloneSession(session)
    let updated: Session | undefined

    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      return result
    })

    await sessionActions.expandFork(session.id, pivot.id)

    expect(session).toEqual(snapshot)
    expect(updated!.messages).toEqual([pivot, current, altA, altB])
    expect(updated!.messageForksHash).toBeUndefined()
  })

  test('regenerateInNewFork creates a new fork for thread messages', async () => {
    uuidQueue.push('fork-1', 'fork-2', 'fork-3', 'fork-4')
    const pivot = makeMessage('pivot', 'user')
    const target = makeMessage('target', 'assistant')
    const thread: SessionThread = {
      id: 'thread-2',
      name: 'Thread',
      createdAt: 1,
      messages: [pivot, target],
    }
    const session: Session = {
      id: 'session-8',
      name: 'Test',
      messages: [],
      threads: [thread],
    }
    const snapshot = cloneSession(session)

    getSessionMock.mockResolvedValue(session)

    let updated: Session | undefined
    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      return result
    })

    const runGenerateMore = vi.fn().mockResolvedValue(undefined)

    await sessionActions.regenerateInNewFork(session.id, target, { runGenerateMore })

    expect(getSessionMock).toHaveBeenCalledWith(session.id)
    expect(updateSessionWithMessages).toHaveBeenCalledTimes(1)
    expect(session).toEqual(snapshot)

    expect(updated).toBeDefined()
    const fork = updated!.messageForksHash?.[pivot.id]
    expect(fork).toBeDefined()
    expect(fork!.lists).toHaveLength(2)
    expect(fork!.lists[0].messages).toEqual([target])
    expect(runGenerateMore).toHaveBeenCalledWith(session.id, pivot.id)
  })

  test('resendEditedMessageInNewFork forks from the previous message to preserve the original user message', async () => {
    uuidQueue.push('fork-1', 'fork-2', 'fork-3', 'edited-copy', 'assistant-copy')
    const previous = makeMessage('previous', 'assistant')
    const originalUser = {
      ...makeMessage('user-original', 'user'),
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = makeMessage('reply-original', 'assistant')
    const editedUser: Message = {
      ...originalUser,
      contentParts: [{ type: 'text', text: 'Problem B' }],
    }
    const session: Session = {
      id: 'session-9',
      name: 'Test',
      messages: [previous, originalUser, originalReply],
    }
    const snapshot = cloneSession(session)

    getSessionMock.mockResolvedValue(session)

    let updated: Session | undefined
    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      session.messages = updated!.messages
      session.threads = updated!.threads
      session.messageForksHash = updated!.messageForksHash
      return result
    })
    insertMessageMock.mockImplementation(async (_, message, previousId) => {
      const previousIndex = session.messages.findIndex((item) => item.id === previousId)
      session.messages = [
        ...session.messages.slice(0, previousIndex + 1),
        message,
        ...session.messages.slice(previousIndex + 1),
      ]
      updated = {
        ...session,
      }
    })

    const runGenerateMore = vi.fn().mockResolvedValue(undefined)

    await sessionActions.resendEditedMessageInNewFork(session.id, originalUser, editedUser, { runGenerateMore })

    expect(getSessionMock).toHaveBeenCalledWith(session.id)
    expect(updateSessionWithMessages).toHaveBeenCalledTimes(1)
    expect(snapshot).toEqual({
      id: 'session-9',
      name: 'Test',
      messages: [previous, originalUser, originalReply],
    })

    expect(updated).toBeDefined()
    expect(updated!.messages).toHaveLength(2)
    expect(updated!.messages[0]).toEqual(previous)
    expect(updated!.messages[1].id).toBe('edited-copy')
    expect(updated!.messages[1].contentParts).toEqual([{ type: 'text', text: 'Problem B' }])

    const fork = updated!.messageForksHash?.[previous.id]
    expect(fork).toBeDefined()
    expect(fork!.lists).toHaveLength(2)
    expect(fork!.position).toBe(1)
    expect(fork!.lists[0].messages).toEqual([originalUser, originalReply])
    expect(fork!.lists[1].messages).toEqual([])
    expect(runGenerateMore).toHaveBeenCalledWith(session.id, 'edited-copy')
  })

  test('resendEditedMessageInNewFork preserves the original first user message by inserting a synthetic fork anchor', async () => {
    uuidQueue.push('edited-copy', 'synthetic-anchor', 'fork-1', 'fork-2')
    const originalUser = {
      ...makeMessage('user-original', 'user'),
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = makeMessage('reply-original', 'assistant')
    const editedUser: Message = {
      ...originalUser,
      contentParts: [{ type: 'text', text: 'Problem B' }],
    }
    const session: Session = {
      id: 'session-10',
      name: 'Test',
      messages: [originalUser, originalReply],
    }
    const snapshot = cloneSession(session)

    getSessionMock.mockResolvedValue(session)

    let updated: Session | undefined
    updateSessionWithMessages.mockImplementation(async (_, updater) => {
      const result = updater(session)
      updated = result as Session
      session.messages = updated!.messages
      session.threads = updated!.threads
      session.messageForksHash = updated!.messageForksHash
      return result
    })
    insertMessageMock.mockImplementation(async (_, message, previousId) => {
      const previousIndex = session.messages.findIndex((item) => item.id === previousId)
      session.messages = [
        ...session.messages.slice(0, previousIndex + 1),
        message,
        ...session.messages.slice(previousIndex + 1),
      ]
      updated = {
        ...session,
      }
    })

    const runGenerateMore = vi.fn().mockResolvedValue(undefined)

    await sessionActions.resendEditedMessageInNewFork(session.id, originalUser, editedUser, { runGenerateMore })

    expect(getSessionMock).toHaveBeenCalledWith(session.id)
    expect(updateSessionWithMessages).toHaveBeenCalledTimes(1)
    expect(insertMessageMock).not.toHaveBeenCalled()
    expect(snapshot).toEqual({
      id: 'session-10',
      name: 'Test',
      messages: [originalUser, originalReply],
    })

    expect(updated).toBeDefined()
    expect(updated!.messages).toHaveLength(2)
    expect(updated!.messages[0]).toMatchObject({
      id: 'synthetic-anchor',
      role: 'system',
      name: '__synthetic_fork_anchor__',
      contentParts: [],
      timestamp: originalUser.timestamp,
    })
    expect(updated!.messages[1].id).toBe('edited-copy')
    expect(updated!.messages[1].contentParts).toEqual([{ type: 'text', text: 'Problem B' }])

    const fork = updated!.messageForksHash?.['synthetic-anchor']
    expect(fork).toBeDefined()
    expect(fork!.lists).toHaveLength(2)
    expect(fork!.position).toBe(1)
    expect(fork!.lists[0].messages).toEqual([originalUser, originalReply])
    expect(fork!.lists[1].messages).toEqual([])
    expect(runGenerateMore).toHaveBeenCalledWith(session.id, 'edited-copy')
  })
})
