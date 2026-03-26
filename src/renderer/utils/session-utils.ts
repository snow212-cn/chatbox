import type { Session, SessionMeta } from '@shared/types'
import { mapValues } from 'lodash'
import { hasMeaningfulMessageContent, isSyntheticForkAnchor, migrateMessage } from '../../shared/utils/message'

function debugForkSummary(messageForksHash: Session['messageForksHash']) {
  return Object.entries(messageForksHash ?? {}).map(([forkId, forkEntry]) => ({
    forkId,
    position: forkEntry.position,
    lists: forkEntry.lists.map((list, listIndex) => ({
      listIndex,
      messageCount: list.messages.length,
      hasVisibleContent: list.messages.some(
        (message) => !isSyntheticForkAnchor(message) && hasMeaningfulMessageContent(message)
      ),
      roles: list.messages.map((message) => message.role),
    })),
  }))
}

export function migrateSession(session: Session): Session {
  const migrated: Session = {
    ...session,
    settings: {
      // temperature未设置的时候使用默认值undefined，这样才能覆盖全局设置
      temperature: undefined,
      ...session.settings,
    },
    messages: session.messages?.map((m) => migrateMessage(m)) || [],
    threads: session.threads?.map((t) => ({
      ...t,
      messages: t.messages.map((m) => migrateMessage(m)) || [],
    })),
    messageForksHash: mapValues(session.messageForksHash || {}, (forks) => ({
      ...forks,
      lists:
        forks.lists?.map((list) => ({
          ...list,
          messages: list.messages?.map((m) => migrateMessage(m)) || [],
        })) || [],
    })),
  }

  let messageForksHash = migrated.messageForksHash
  const recoveredRoot = recoverSyntheticAnchorForks(migrated.messages, messageForksHash, { allowOrphanFallback: true })
  messageForksHash = recoveredRoot.messageForksHash

  const recoveredThreads = migrated.threads?.map((thread) => {
    const recoveredThread = recoverSyntheticAnchorForks(thread.messages, messageForksHash)
    messageForksHash = recoveredThread.messageForksHash
    return {
      ...thread,
      messages: recoveredThread.messages,
    }
  })

  const rootHasVisibleContent = recoveredRoot.messages.some(
    (message) => !isSyntheticForkAnchor(message) && hasMeaningfulMessageContent(message)
  )
  if (!rootHasVisibleContent && messageForksHash) {
    console.warn('[session-utils] migrated session still has no visible root messages', {
      sessionId: session.id,
      rootMessageCount: recoveredRoot.messages.length,
      rootRoles: recoveredRoot.messages.map((message) => message.role),
      forkSummary: debugForkSummary(messageForksHash),
    })
  }

  return {
    ...migrated,
    messages: recoveredRoot.messages,
    threads: recoveredThreads,
    messageForksHash,
  }
}

export function mirrorVisibleSyntheticForkBranches(session: Session): Session {
  if (!session.messageForksHash) {
    return session
  }

  let nextForks = session.messageForksHash
  let changed = false

  const hasCompleteAssistantOutput = (branchMessages: Session['messages']) =>
    branchMessages.some(
      (branchMessage) =>
        branchMessage.role === 'assistant' &&
        !isSyntheticForkAnchor(branchMessage) &&
        hasMeaningfulMessageContent(branchMessage)
    )

  const hasVisibleConversationContent = (branchMessages: Session['messages']) =>
    branchMessages.some((branchMessage) => !isSyntheticForkAnchor(branchMessage) && hasMeaningfulMessageContent(branchMessage))

  const syncMessageList = (messages: Session['messages']) => {
    for (let index = 0; index < messages.length; index++) {
      const message = messages[index]
      if (!isSyntheticForkAnchor(message)) {
        continue
      }

      const forkEntry = nextForks?.[message.id]
      if (!forkEntry) {
        continue
      }

      const activeList = forkEntry.lists[forkEntry.position]
      const currentTail = messages.slice(index + 1)
      if (!activeList || !hasCompleteAssistantOutput(currentTail) || hasVisibleConversationContent(activeList.messages)) {
        continue
      }

      nextForks = {
        ...(nextForks ?? {}),
        [message.id]: {
          ...forkEntry,
          lists: forkEntry.lists.map((list, listIndex) =>
            listIndex === forkEntry.position
              ? {
                  ...list,
                  messages: currentTail,
                }
              : list
          ),
        },
      }
      changed = true
    }
  }

  syncMessageList(session.messages)
  session.threads?.forEach((thread) => syncMessageList(thread.messages))

  if (!changed) {
    return session
  }

  return {
    ...session,
    messageForksHash: nextForks,
  }
}

function recoverSyntheticAnchorForks(
  messages: Session['messages'],
  messageForksHash: Session['messageForksHash'],
  options?: { allowOrphanFallback?: boolean }
): { messages: Session['messages']; messageForksHash: Session['messageForksHash'] } {
  let recoveredMessages = messages
  let recoveredForks = messageForksHash

  // A synthetic anchor branch is only reliable after the regenerated assistant
  // message has been persisted with meaningful content. If we only have
  // user-side messages or empty assistant placeholders after the anchor,
  // prefer recovering the last complete branch from fork storage.
  const hasCompleteAssistantOutput = (branchMessages: Session['messages']) =>
    branchMessages.some(
      (branchMessage) =>
        branchMessage.role === 'assistant' &&
        !isSyntheticForkAnchor(branchMessage) &&
        hasMeaningfulMessageContent(branchMessage)
    )

  const hasVisibleConversationContent = (branchMessages: Session['messages']) =>
    branchMessages.some((branchMessage) => !isSyntheticForkAnchor(branchMessage) && hasMeaningfulMessageContent(branchMessage))

  const pickPreferredCandidate = (
    candidates: Array<{
      list: NonNullable<NonNullable<Session['messageForksHash']>[string]['lists']>[number]
      listIndex: number
      forkEntry: NonNullable<Session['messageForksHash']>[string]
    }>
  ) => {
    const activeCandidate = candidates.find(({ listIndex, forkEntry }) => listIndex === forkEntry.position)
    return (
      (activeCandidate && hasCompleteAssistantOutput(activeCandidate.list.messages) ? activeCandidate : undefined) ??
      candidates.find(({ list }) => hasCompleteAssistantOutput(list.messages)) ??
      activeCandidate ??
      candidates[0]
    )
  }

  const removeForkEntry = (forkMessageId: string) => {
    const { [forkMessageId]: _removed, ...rest } = recoveredForks ?? {}
    recoveredForks = Object.keys(rest).length ? rest : undefined
  }

  for (let index = 0; index < recoveredMessages.length; index++) {
    const message = recoveredMessages[index]
    if (!isSyntheticForkAnchor(message)) {
      continue
    }

    const forkEntry = recoveredForks?.[message.id]
    if (!forkEntry) {
      continue
    }

    const currentTail = recoveredMessages.slice(index + 1)
    const activeList = forkEntry.lists[forkEntry.position]

    // Keep the currently visible branch mirrored in fork storage once it has
    // complete assistant output. This prevents downstream restore logic from
    // interpreting the selected branch as empty after restart.
    if (
      hasCompleteAssistantOutput(currentTail) &&
      activeList &&
      !hasVisibleConversationContent(activeList.messages)
    ) {
      recoveredForks = {
        ...(recoveredForks ?? {}),
        [message.id]: {
          ...forkEntry,
          lists: forkEntry.lists.map((list, listIndex) =>
            listIndex === forkEntry.position
              ? {
                  ...list,
                  messages: currentTail,
                }
              : list
          ),
        },
      }
      continue
    }

    if (hasCompleteAssistantOutput(currentTail)) {
      continue
    }

    const nonEmptyLists = forkEntry.lists
      .map((list, listIndex) => ({ list, listIndex }))
      .filter(({ list }) => list.messages.length > 0)

    if (nonEmptyLists.length === 0) {
      continue
    }

    const prefixWithoutAnchor = recoveredMessages.slice(0, index)

    if (nonEmptyLists.length === 1) {
      recoveredMessages = prefixWithoutAnchor.concat(nonEmptyLists[0].list.messages)
      removeForkEntry(message.id)
      index = Math.max(-1, prefixWithoutAnchor.length - 1)
      continue
    }

    const fallbackPosition = nonEmptyLists[0].listIndex
    recoveredMessages = recoveredMessages.slice(0, index + 1).concat(nonEmptyLists[0].list.messages)
    recoveredForks = {
      ...(recoveredForks ?? {}),
      [message.id]: {
        ...forkEntry,
        position: fallbackPosition,
        lists: forkEntry.lists.map((list, listIndex) =>
          listIndex === fallbackPosition
            ? {
                ...list,
                messages: [],
              }
            : list
        ),
      },
    }
  }

  // Safety net:
  // If recovery leaves only synthetic anchors or non-meaningful placeholders,
  // attempt to restore from the active/valid fork branch so the session does
  // not render as a blank conversation after restart.
  if (!hasVisibleConversationContent(recoveredMessages) && recoveredForks) {
    for (let index = 0; index < recoveredMessages.length; index++) {
      const message = recoveredMessages[index]
      if (!isSyntheticForkAnchor(message)) {
        continue
      }

      const forkEntry = recoveredForks?.[message.id]
      if (!forkEntry) {
        continue
      }

      const candidates = forkEntry.lists
        .map((list, listIndex) => ({ list, listIndex }))
        .filter(({ list }) => hasVisibleConversationContent(list.messages))

      if (candidates.length === 0) {
        continue
      }

      const preferred = pickPreferredCandidate(candidates.map((candidate) => ({ ...candidate, forkEntry })))

      recoveredMessages = recoveredMessages.slice(0, index).concat(preferred.list.messages)
      removeForkEntry(message.id)
      break
    }
  }

  // Broader root-level recovery:
  // if the root message list itself was persisted as blank but fork storage still
  // retains visible branches, restore the best available branch instead of
  // rendering an empty conversation after restart.
  if (options?.allowOrphanFallback && !hasVisibleConversationContent(recoveredMessages) && recoveredForks) {
    const orphanCandidates = Object.values(recoveredForks).flatMap((forkEntry) =>
      forkEntry.lists
        .map((list, listIndex) => ({ list, listIndex, forkEntry }))
        .filter(({ list }) => hasVisibleConversationContent(list.messages))
    )

    if (orphanCandidates.length > 0) {
      const preferred = pickPreferredCandidate(orphanCandidates)
      recoveredMessages = preferred.list.messages
      recoveredForks = undefined
    }
  }

  return {
    messages: recoveredMessages,
    messageForksHash: recoveredForks,
  }
}

export function sortSessions(sessions: SessionMeta[]): SessionMeta[] {
  const reversed: SessionMeta[] = []
  const pinned: SessionMeta[] = []
  for (const sess of sessions) {
    // Skip hidden sessions (e.g., migrated picture sessions)
    if (sess.hidden) {
      continue
    }
    if (sess.starred) {
      pinned.push(sess)
      continue
    }
    reversed.unshift(sess)
  }
  return pinned.concat(reversed)
}
