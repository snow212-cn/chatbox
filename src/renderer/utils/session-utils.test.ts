import type { Session } from '@shared/types'
import { describe, expect, test } from 'vitest'
import { migrateSession } from './session-utils'

describe('migrateSession', () => {
  test('recovers a synthetic anchor session that was persisted before the edited branch message was inserted', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer A' }],
      timestamp: 124,
    }
    const session: Session = {
      id: 'session-blank',
      name: 'Recovered',
      messages: [
        {
          id: 'synthetic-anchor',
          role: 'system',
          name: '__synthetic_fork_anchor__',
          contentParts: [],
          timestamp: 123,
        },
      ],
      messageForksHash: {
        'synthetic-anchor': {
          createdAt: 125,
          position: 1,
          lists: [
            {
              id: 'fork_list_1',
              messages: [originalUser, originalReply],
            },
            {
              id: 'fork_list_2',
              messages: [],
            },
          ],
        },
      },
    }

    const migrated = migrateSession(session)

    expect(migrated.messages).toEqual([originalUser, originalReply])
    expect(migrated.messageForksHash).toBeUndefined()
  })

  test('recovers a synthetic anchor session when only the edited user branch was persisted', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer A' }],
      timestamp: 124,
    }
    const editedUser = {
      id: 'user-edited',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem B' }],
      timestamp: 125,
    }
    const session: Session = {
      id: 'session-incomplete-branch',
      name: 'Recovered',
      messages: [
        {
          id: 'synthetic-anchor',
          role: 'system',
          name: '__synthetic_fork_anchor__',
          contentParts: [],
          timestamp: 123,
        },
        editedUser,
      ],
      messageForksHash: {
        'synthetic-anchor': {
          createdAt: 125,
          position: 1,
          lists: [
            {
              id: 'fork_list_1',
              messages: [originalUser, originalReply],
            },
            {
              id: 'fork_list_2',
              messages: [],
            },
          ],
        },
      },
    }

    const migrated = migrateSession(session)

    expect(migrated.messages).toEqual([originalUser, originalReply])
    expect(migrated.messageForksHash).toBeUndefined()
  })

  test('recovers a synthetic anchor session when the regenerated branch only persisted an empty assistant placeholder', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer A' }],
      timestamp: 124,
    }
    const editedUser = {
      id: 'user-edited',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem B' }],
      timestamp: 125,
    }
    const pendingReply = {
      id: 'assistant-pending',
      role: 'assistant' as const,
      contentParts: [],
      generating: true,
      timestamp: 126,
    }
    const session: Session = {
      id: 'session-empty-assistant-placeholder',
      name: 'Recovered',
      messages: [
        {
          id: 'synthetic-anchor',
          role: 'system',
          name: '__synthetic_fork_anchor__',
          contentParts: [],
          timestamp: 123,
        },
        editedUser,
        pendingReply,
      ],
      messageForksHash: {
        'synthetic-anchor': {
          createdAt: 125,
          position: 1,
          lists: [
            {
              id: 'fork_list_1',
              messages: [originalUser, originalReply],
            },
            {
              id: 'fork_list_2',
              messages: [],
            },
          ],
        },
      },
    }

    const migrated = migrateSession(session)

    expect(migrated.messages).toEqual([originalUser, originalReply])
    expect(migrated.messageForksHash).toBeUndefined()
  })

  test('recovers visible content when a synthetic-only fork list is selected and root would otherwise render blank', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer A' }],
      timestamp: 124,
    }

    const hiddenForkAnchor = {
      id: 'synthetic-anchor-hidden',
      role: 'system' as const,
      name: '__synthetic_fork_anchor__',
      contentParts: [],
      timestamp: 125,
    }

    const session: Session = {
      id: 'session-hidden-fork-list-selected',
      name: 'Recovered',
      messages: [
        {
          id: 'synthetic-anchor',
          role: 'system',
          name: '__synthetic_fork_anchor__',
          contentParts: [],
          timestamp: 123,
        },
      ],
      messageForksHash: {
        'synthetic-anchor': {
          createdAt: 126,
          position: 0,
          lists: [
            {
              id: 'fork_list_hidden_only',
              messages: [hiddenForkAnchor],
            },
            {
              id: 'fork_list_visible',
              messages: [originalUser, originalReply],
            },
          ],
        },
      },
    }

    const migrated = migrateSession(session)

    expect(migrated.messages).toEqual([originalUser, originalReply])
    expect(migrated.messageForksHash).toBeUndefined()
  })

  test('keeps the active edited branch when the regenerated assistant reply has meaningful content', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer A' }],
      timestamp: 124,
    }
    const editedUser = {
      id: 'user-edited',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem B' }],
      timestamp: 125,
    }
    const editedReply = {
      id: 'reply-edited',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer B' }],
      timestamp: 126,
    }
    const session: Session = {
      id: 'session-active-edited-branch',
      name: 'Recovered',
      messages: [
        {
          id: 'synthetic-anchor',
          role: 'system',
          name: '__synthetic_fork_anchor__',
          contentParts: [],
          timestamp: 123,
        },
        editedUser,
        editedReply,
      ],
      messageForksHash: {
        'synthetic-anchor': {
          createdAt: 126,
          position: 1,
          lists: [
            {
              id: 'fork_list_original',
              messages: [originalUser, originalReply],
            },
            {
              id: 'fork_list_active',
              messages: [],
            },
          ],
        },
      },
    }

    const migrated = migrateSession(session)

    expect(migrated.messages).toEqual(session.messages)
    expect(migrated.messageForksHash).toEqual(session.messageForksHash)
  })

  test('recovers visible root content from fork storage when the root message list was persisted as empty', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer A' }],
      timestamp: 124,
    }

    const session: Session = {
      id: 'session-empty-root-with-fork-content',
      name: 'Recovered',
      messages: [],
      messageForksHash: {
        'synthetic-anchor': {
          createdAt: 125,
          position: 1,
          lists: [
            {
              id: 'fork_list_original',
              messages: [originalUser, originalReply],
            },
            {
              id: 'fork_list_active',
              messages: [],
            },
          ],
        },
      },
    }

    const migrated = migrateSession(session)

    expect(migrated.messages).toEqual([originalUser, originalReply])
    expect(migrated.messageForksHash).toBeUndefined()
  })

  test('prefers the active visible branch when recovering an empty root from fork storage', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem A' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer A' }],
      timestamp: 124,
    }
    const editedUser = {
      id: 'user-edited',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Problem B' }],
      timestamp: 125,
    }
    const editedReply = {
      id: 'reply-edited',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Answer B' }],
      timestamp: 126,
    }

    const session: Session = {
      id: 'session-empty-root-active-visible-branch',
      name: 'Recovered',
      messages: [],
      messageForksHash: {
        'synthetic-anchor': {
          createdAt: 126,
          position: 1,
          lists: [
            {
              id: 'fork_list_original',
              messages: [originalUser, originalReply],
            },
            {
              id: 'fork_list_active',
              messages: [editedUser, editedReply],
            },
          ],
        },
      },
    }

    const migrated = migrateSession(session)

    expect(migrated.messages).toEqual([editedUser, editedReply])
    expect(migrated.messageForksHash).toBeUndefined()
  })
})
