/* @vitest-environment jsdom */

import type { Session } from '@shared/types'
import { describe, expect, test } from 'vitest'
import { getAllMessageList } from './sessionHelpers'

describe('getAllMessageList', () => {
  test('falls back to a visible fork branch when the flattened session would otherwise render blank', () => {
    const originalUser = {
      id: 'user-original',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'hi' }],
      timestamp: 123,
    }
    const originalReply = {
      id: 'reply-original',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Hi! How can I help?' }],
      timestamp: 124,
    }

    const session: Session = {
      id: 'session-blank-render-fallback',
      name: 'Recovered',
      type: 'chat',
      messages: [
        {
          id: 'synthetic-anchor',
          role: 'system',
          name: '__synthetic_fork_anchor__',
          contentParts: [],
          timestamp: 122,
        },
      ],
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

    expect(getAllMessageList(session)).toEqual([originalUser, originalReply])
  })
})
