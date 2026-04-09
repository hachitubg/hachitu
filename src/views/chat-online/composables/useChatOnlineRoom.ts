import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  useClipboard,
  useDebounceFn,
  useIntervalFn,
  useLocalStorage,
  useNow,
  useOnline,
  useWebSocket,
} from '@vueuse/core'
import {
  createChatRoom,
  getChatDiscoveries,
  getChatRoom,
  getYahooEmoticons,
  joinChatRoom,
  leaveChatRoom,
} from '../api/client'
import { parseChatSocketMessage, serializeChatSocketMessage, toChatWebSocketUrl } from '../api/ws'
import type {
  ChatDiscoveryItem,
  ChatMediaAttachment,
  ChatParticipant,
  ChatRoomRecord,
  ChatSocketServerMessage,
  StoredChatProfile,
  StoredChatRoomIdentity,
  StoredChatSavedRoom,
  YahooEmoticon,
} from '../api/types'

const DEFAULT_DISCOVERY_KIND = 'mixed'
const TYPING_WINDOW_MS = 4000
const MEDIA_URL_RE = /^https:\/\/[^\s]+$/i

type ComposerPanel = 'none' | 'yahoo' | 'discoveries' | 'media'

function createDefaultProfile(): StoredChatProfile {
  return {
    globalSessionId: crypto.randomUUID(),
    displayName: '',
    rooms: {},
  }
}

function getErrorMessage(error: Error | string): string {
  return typeof error === 'string' ? error : error.message || 'Đã có lỗi xảy ra.'
}

function buildAttachment(
  templateId: string,
  title: string,
  mediaUrl: string,
  mediaKind: 'image' | 'gif' | 'video',
  pageUrl: string | null,
  previewUrl: string | null,
): ChatMediaAttachment {
  return {
    templateId,
    title,
    mediaUrl,
    mediaKind,
    pageUrl,
    previewUrl,
  }
}

export function useChatOnlineRoom() {
  const route = useRoute()
  const router = useRouter()
  const now = useNow({ interval: 1000 })
  const isOnline = useOnline()
  const profile = useLocalStorage<StoredChatProfile>(
    'hachitu-chat-online-profile',
    createDefaultProfile(),
  )
  const savedRooms = useLocalStorage<StoredChatSavedRoom[]>('hachitu-chat-online-rooms', [])
  const messageDraft = ref('')
  const roomNameDraft = ref('Sunlit Hangout')
  const inviteCodeDraft = ref('')
  const activeRoom = ref<ChatRoomRecord | null>(null)
  const activeIdentity = ref<StoredChatRoomIdentity | null>(null)
  const errorMessage = ref('')
  const isBusy = ref(false)
  const discoveryKind = ref<'image' | 'gif' | 'mixed'>(DEFAULT_DISCOVERY_KIND)
  const discoveries = ref<ChatDiscoveryItem[]>([])
  const yahooEmoticons = ref<YahooEmoticon[]>([])
  const yahooSearch = ref('')
  const mediaKindDraft = ref<'image' | 'video'>('image')
  const mediaUrlDraft = ref('')
  const mediaTitleDraft = ref('')
  const isLoadingDiscoveries = ref(false)
  const isLoadingYahoo = ref(false)
  const isSyncingSavedRooms = ref(false)
  const socketPath = ref('')
  const socketConnected = ref(false)
  const lastJoinedRoomId = ref('')
  const composerPanel = ref<ComposerPanel>('none')

  const { copy, copied } = useClipboard()

  const socket = useWebSocket(socketPath, {
    immediate: false,
    autoConnect: false,
    autoReconnect: {
      retries: 6,
      delay: 1200,
    },
    onConnected() {
      socketConnected.value = true
      errorMessage.value = ''
      startPing()
      socket.send(serializeChatSocketMessage({ type: 'hello' }))
    },
    onDisconnected() {
      socketConnected.value = false
      stopPing()
    },
    onMessage(_socketInstance, event) {
      if (typeof event.data !== 'string') {
        return
      }

      const parsed = parseChatSocketMessage(event.data)
      if (!parsed) {
        return
      }

      applySocketMessage(parsed)
    },
    onError() {
      errorMessage.value = 'Kết nối realtime đang gặp sự cố.'
    },
  })

  const currentRoomId = computed(() => {
    const value = route.query.room
    return typeof value === 'string' ? value : ''
  })

  const inviteLink = computed(() => {
    if (!currentRoomId.value) {
      return ''
    }
    return `${window.location.origin}/chat-online?room=${currentRoomId.value}`
  })

  const connectionLabel = computed(() => {
    if (!isOnline.value) {
      return 'Offline'
    }
    return socketConnected.value ? 'Realtime đang bật' : 'Đang chờ kết nối'
  })

  const onlineParticipants = computed(() =>
    (activeRoom.value?.participants ?? []).filter((participant) => participant.connected),
  )

  const typingParticipants = computed(() => {
    const currentParticipantId = activeIdentity.value?.participantId ?? ''
    return (activeRoom.value?.participants ?? []).filter((participant) => {
      if (!participant.connected || !participant.lastTypingAt) {
        return false
      }
      if (participant.participantId === currentParticipantId) {
        return false
      }
      return now.value.getTime() - participant.lastTypingAt < TYPING_WINDOW_MS
    })
  })

  const expiresInLabel = computed(() => {
    if (!activeRoom.value) {
      return 'Chưa có room'
    }

    const diffMs = Math.max(activeRoom.value.expiresAt - now.value.getTime(), 0)
    const hours = Math.floor(diffMs / (60 * 60 * 1000))
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000))
    return `${hours}h ${minutes}m`
  })

  const filteredYahooEmoticons = computed(() => {
    const keyword = yahooSearch.value.trim().toLowerCase()
    if (!keyword) {
      return yahooEmoticons.value
    }

    return yahooEmoticons.value.filter((item) => {
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword)
      )
    })
  })

  const environmentHint = computed(() => {
    if (!import.meta.env.DEV) {
      return ''
    }

    const { hostname, port } = window.location
    const isLocal = hostname === '127.0.0.1' || hostname === 'localhost'
    if (isLocal && port !== '8787') {
      return 'Chat realtime cần chạy qua `pnpm dev:worker` và mở ở cổng 8787.'
    }

    return ''
  })

  const sendTypingSignal = useDebounceFn(() => {
    if (!socketConnected.value) {
      return
    }
    socket.send(serializeChatSocketMessage({ type: 'typing' }))
  }, 350, { maxWait: 1500 })

  const { pause: stopPing, resume: startPing } = useIntervalFn(() => {
    if (!socketConnected.value) {
      return
    }
    socket.send(serializeChatSocketMessage({ type: 'ping', clientTime: Date.now() }))
  }, 20000, { immediate: false })

  function setRoomQuery(roomId: string) {
    const query = { ...route.query }

    if (roomId) {
      query.room = roomId
    } else {
      delete query.room
    }

    router.replace({ query })
  }

  function storeIdentity(roomId: string, identity: StoredChatRoomIdentity) {
    profile.value = {
      ...profile.value,
      displayName: identity.displayName,
      rooms: {
        ...profile.value.rooms,
        [roomId]: identity,
      },
    }
    activeIdentity.value = identity
  }

  function upsertParticipant(participant: ChatParticipant) {
    const room = activeRoom.value
    if (!room) {
      return
    }

    const existingIndex = room.participants.findIndex(
      (entry) => entry.participantId === participant.participantId,
    )

    if (existingIndex === -1) {
      activeRoom.value = {
        ...room,
        participants: [...room.participants, participant],
      }
      return
    }

    const nextParticipants = [...room.participants]
    nextParticipants[existingIndex] = participant
    activeRoom.value = {
      ...room,
      participants: nextParticipants,
    }
  }

  function upsertSavedRoom(roomRecord: ChatRoomRecord, identity: StoredChatRoomIdentity | null) {
    if (!identity) {
      return
    }

    const role = roomRecord.hostParticipantId === identity.participantId ? 'host' : 'member'
    const nextEntry: StoredChatSavedRoom = {
      roomId: roomRecord.roomId,
      roomName: roomRecord.roomName,
      participantId: identity.participantId,
      sessionId: identity.sessionId,
      displayName: identity.displayName,
      role,
      lastVisitedAt: Date.now(),
    }

    const next = savedRooms.value.filter((item) => item.roomId !== roomRecord.roomId)
    savedRooms.value = [nextEntry, ...next].slice(0, 24)
  }

  function removeSavedRoom(roomId: string) {
    savedRooms.value = savedRooms.value.filter((item) => item.roomId !== roomId)
  }

  function applySocketMessage(message: ChatSocketServerMessage) {
    if (message.type === 'initial_state') {
      activeRoom.value = message.room
      upsertSavedRoom(message.room, activeIdentity.value)
      return
    }

    if (!activeRoom.value) {
      return
    }

    if (message.type === 'participant_joined') {
      upsertParticipant(message.participant)
      return
    }

    if (message.type === 'participant_left') {
      activeRoom.value = {
        ...activeRoom.value,
        participants: activeRoom.value.participants.map((participant) =>
          participant.participantId === message.participantId
            ? { ...participant, connected: false }
            : participant,
        ),
      }
      return
    }

    if (message.type === 'presence_updated') {
      activeRoom.value = {
        ...activeRoom.value,
        participants: message.participants,
      }
      return
    }

    if (message.type === 'typing_updated') {
      activeRoom.value = {
        ...activeRoom.value,
        participants: activeRoom.value.participants.map((participant) =>
          participant.participantId === message.participantId
            ? { ...participant, lastTypingAt: message.lastTypingAt }
            : participant,
        ),
      }
      return
    }

    if (message.type === 'message_created') {
      activeRoom.value = {
        ...activeRoom.value,
        version: message.roomVersion,
        messages: [...activeRoom.value.messages, message.message].slice(-180),
      }
      return
    }

    if (message.type === 'room_expiring') {
      if (activeRoom.value) {
        removeSavedRoom(activeRoom.value.roomId)
      }
      errorMessage.value = 'Room này đã hết hạn và sẽ đóng.'
      return
    }

    if (message.type === 'action_rejected') {
      errorMessage.value = message.reason
    }
  }

  async function loadDiscoveries(kind = discoveryKind.value) {
    isLoadingDiscoveries.value = true

    try {
      discoveryKind.value = kind
      const response = await getChatDiscoveries(kind, 12)
      discoveries.value = response.discoveries
    } catch (error) {
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    } finally {
      isLoadingDiscoveries.value = false
    }
  }

  async function loadYahooList() {
    if (yahooEmoticons.value.length || isLoadingYahoo.value) {
      return
    }

    isLoadingYahoo.value = true

    try {
      yahooEmoticons.value = await getYahooEmoticons()
    } catch (error) {
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    } finally {
      isLoadingYahoo.value = false
    }
  }

  async function refreshRoomState(roomId: string) {
    try {
      const response = await getChatRoom(roomId)
      activeRoom.value = response.room
      upsertSavedRoom(response.room, activeIdentity.value)
    } catch (error) {
      removeSavedRoom(roomId)
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    }
  }

  async function syncSavedRooms() {
    if (isSyncingSavedRooms.value || !savedRooms.value.length) {
      return
    }

    isSyncingSavedRooms.value = true

    try {
      const nextRooms: StoredChatSavedRoom[] = []

      for (const item of savedRooms.value) {
        try {
          const response = await getChatRoom(item.roomId)
          nextRooms.push({
            ...item,
            roomName: response.room.roomName,
          })
        } catch {
          // Drop expired or deleted rooms.
        }
      }

      savedRooms.value = nextRooms
    } finally {
      isSyncingSavedRooms.value = false
    }
  }

  async function connectToRoom(roomId: string) {
    const savedIdentity = savedRooms.value.find((item) => item.roomId === roomId) ?? null
    const storedIdentity = profile.value.rooms[roomId]
    const preferredDisplayName =
      storedIdentity?.displayName ??
      savedIdentity?.displayName ??
      profile.value.displayName.trim()
    const displayName = preferredDisplayName || 'Guest'

    isBusy.value = true
    errorMessage.value = ''

    try {
      const response = await joinChatRoom(roomId, {
        displayName,
        participantId: storedIdentity?.participantId ?? savedIdentity?.participantId ?? '',
        sessionId:
          storedIdentity?.sessionId ?? savedIdentity?.sessionId ?? profile.value.globalSessionId,
      })

      if (!response.participant) {
        throw new Error('Không thể tham gia room này.')
      }

      const identity = {
        participantId: response.participant.participantId,
        sessionId: response.participant.sessionId,
        displayName: response.participant.displayName,
      }

      storeIdentity(roomId, identity)
      activeRoom.value = response.room
      upsertSavedRoom(response.room, identity)
      lastJoinedRoomId.value = roomId
      stopPing()
      socket.close()
      socketPath.value = toChatWebSocketUrl(response.websocketUrl)
      socketConnected.value = false
      socket.open()
    } catch (error) {
      removeSavedRoom(roomId)
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    } finally {
      isBusy.value = false
    }
  }

  async function createRoom() {
    const displayName = profile.value.displayName.trim() || 'Host'
    isBusy.value = true
    errorMessage.value = ''

    try {
      const response = await createChatRoom({
        displayName,
        roomName: roomNameDraft.value.trim() || 'Sunlit Hangout',
      })

      const identity = {
        participantId: response.host.participantId,
        sessionId: response.host.sessionId,
        displayName: response.host.displayName,
      }

      storeIdentity(response.roomId, identity)
      upsertSavedRoom(response.room, identity)
      inviteCodeDraft.value = response.roomId
      setRoomQuery(response.roomId)
    } catch (error) {
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    } finally {
      isBusy.value = false
    }
  }

  async function joinRoomFromInvite() {
    const roomId = inviteCodeDraft.value.trim()
    if (!roomId) {
      errorMessage.value = 'Nhập mã room hoặc mở link mời.'
      return
    }

    if (currentRoomId.value === roomId) {
      await connectToRoom(roomId)
      return
    }

    setRoomQuery(roomId)
  }

  function openSavedRoom(roomId: string) {
    inviteCodeDraft.value = roomId
    if (currentRoomId.value === roomId) {
      connectToRoom(roomId)
      return
    }
    setRoomQuery(roomId)
  }

  async function leaveRoom() {
    const roomId = currentRoomId.value
    const identity = activeIdentity.value

    stopPing()
    socket.close()
    socketConnected.value = false

    if (roomId && identity) {
      try {
        await leaveChatRoom(roomId, { participantId: identity.participantId })
      } catch {
        // Ignore leave failures during teardown.
      }
    }

    activeRoom.value = null
    activeIdentity.value = null
    lastJoinedRoomId.value = ''
    composerPanel.value = 'none'
    setRoomQuery('')
  }

  function sendTextMessage() {
    const text = messageDraft.value.trim()
    if (!text || !socketConnected.value) {
      return
    }

    socket.send(
      serializeChatSocketMessage({
        type: 'send_message',
        kind: 'text',
        text,
      }),
    )
    messageDraft.value = ''
  }

  function sendYahooIconMessage(item: YahooEmoticon) {
    if (!socketConnected.value) {
      return
    }

    socket.send(
      serializeChatSocketMessage({
        type: 'send_message',
        kind: 'icon',
        icon: buildAttachment(item.id, item.title, item.imageUrl, 'gif', null, item.imageUrl),
      }),
    )
    composerPanel.value = 'none'
  }

  function sendMemeMessage(item: ChatDiscoveryItem) {
    if (!socketConnected.value) {
      return
    }

    socket.send(
      serializeChatSocketMessage({
        type: 'send_message',
        kind: 'meme',
        meme: buildAttachment(
          item.id,
          item.title,
          item.imageUrl,
          item.mediaKind,
          item.pageUrl,
          item.mediaKind === 'video' || item.mediaKind === 'gif' ? null : item.imageUrl,
        ),
      }),
    )
    composerPanel.value = 'none'
  }

  function sendMediaMessage() {
    if (!socketConnected.value) {
      return
    }

    const mediaUrl = mediaUrlDraft.value.trim()
    const title = mediaTitleDraft.value.trim() || (mediaKindDraft.value === 'image' ? 'Image' : 'Video')

    if (!MEDIA_URL_RE.test(mediaUrl)) {
      errorMessage.value = 'Chỉ hỗ trợ media URL dạng https://'
      return
    }

    if (mediaKindDraft.value === 'image') {
      socket.send(
        serializeChatSocketMessage({
          type: 'send_message',
          kind: 'image',
          image: buildAttachment(
            crypto.randomUUID().replace(/-/g, '').slice(0, 12),
            title,
            mediaUrl,
            'image',
            mediaUrl,
            mediaUrl,
          ),
        }),
      )
    } else {
      socket.send(
        serializeChatSocketMessage({
          type: 'send_message',
          kind: 'video',
          video: buildAttachment(
            crypto.randomUUID().replace(/-/g, '').slice(0, 12),
            title,
            mediaUrl,
            'video',
            mediaUrl,
            null,
          ),
        }),
      )
    }

    mediaUrlDraft.value = ''
    mediaTitleDraft.value = ''
    composerPanel.value = 'none'
  }

  function copyInviteLink() {
    if (!inviteLink.value) {
      return
    }
    copy(inviteLink.value)
  }

  function markTyping() {
    if (messageDraft.value.trim()) {
      sendTypingSignal()
    }
  }

  async function openComposerPanel(panel: ComposerPanel) {
    composerPanel.value = composerPanel.value === panel ? 'none' : panel

    if (composerPanel.value === 'yahoo') {
      await loadYahooList()
      return
    }

    if (composerPanel.value === 'discoveries' && !discoveries.value.length) {
      await loadDiscoveries()
    }
  }

  watch(
    currentRoomId,
    async (roomId) => {
      if (!roomId) {
        activeRoom.value = null
        activeIdentity.value = null
        stopPing()
        socket.close()
        socketConnected.value = false
        socketPath.value = ''
        return
      }

      activeIdentity.value = profile.value.rooms[roomId] ?? null

      if (roomId !== lastJoinedRoomId.value && !isBusy.value) {
        await connectToRoom(roomId)
      }
    },
    { immediate: true },
  )

  watch(
    () => route.fullPath,
    () => {
      if (currentRoomId.value) {
        inviteCodeDraft.value = currentRoomId.value
      }
    },
    { immediate: true },
  )

  loadYahooList()
  syncSavedRooms()

  onBeforeUnmount(() => {
    stopPing()
    socket.close()
    socketPath.value = ''
  })

  return {
    profile,
    savedRooms,
    messageDraft,
    roomNameDraft,
    inviteCodeDraft,
    activeRoom,
    activeIdentity,
    errorMessage,
    isBusy,
    discoveries,
    yahooEmoticons,
    filteredYahooEmoticons,
    yahooSearch,
    discoveryKind,
    mediaKindDraft,
    mediaUrlDraft,
    mediaTitleDraft,
    composerPanel,
    isLoadingDiscoveries,
    isLoadingYahoo,
    isSyncingSavedRooms,
    currentRoomId,
    inviteLink,
    copied,
    connectionLabel,
    onlineParticipants,
    typingParticipants,
    expiresInLabel,
    isOnline,
    socketConnected,
    now,
    environmentHint,
    createRoom,
    joinRoomFromInvite,
    openSavedRoom,
    leaveRoom,
    sendTextMessage,
    sendYahooIconMessage,
    sendMemeMessage,
    sendMediaMessage,
    copyInviteLink,
    loadDiscoveries,
    refreshRoomState,
    syncSavedRooms,
    markTyping,
    openComposerPanel,
  }
}
