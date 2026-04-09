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
const DISCOVERY_PAGE_SIZE = 12
const TYPING_WINDOW_MS = 4000

type ComposerPanel = 'none' | 'yahoo' | 'discoveries'

function createDefaultProfile(): StoredChatProfile {
  return {
    globalSessionId: crypto.randomUUID(),
    displayName: '',
    avatarPreset: 'fox',
    avatarImageDataUrl: null,
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Không thể đọc ảnh avatar.'))
    }
    reader.onerror = () => reject(new Error('Không thể đọc ảnh avatar.'))
    reader.readAsDataURL(file)
  })
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
  const displayNameDraft = ref('')
  const roomNameDraft = ref('')
  const inviteCodeDraft = ref('')
  const messageDraft = ref('')
  const activeRoom = ref<ChatRoomRecord | null>(null)
  const roomPreview = ref<ChatRoomRecord | null>(null)
  const activeIdentity = ref<StoredChatRoomIdentity | null>(null)
  const errorMessage = ref('')
  const isBusy = ref(false)
  const discoveryKind = ref<'image' | 'gif' | 'mixed'>(DEFAULT_DISCOVERY_KIND)
  const discoveries = ref<ChatDiscoveryItem[]>([])
  const yahooEmoticons = ref<YahooEmoticon[]>([])
  const yahooSearch = ref('')
  const isLoadingDiscoveries = ref(false)
  const isLoadingMoreDiscoveries = ref(false)
  const isLoadingYahoo = ref(false)
  const isSyncingSavedRooms = ref(false)
  const socketPath = ref('')
  const socketConnected = ref(false)
  const lastJoinedRoomId = ref('')
  const composerPanel = ref<ComposerPanel>('none')

  const avatarPresets = [
    { id: 'fox', label: 'Fox', emoji: '🦊' },
    { id: 'cat', label: 'Cat', emoji: '🐱' },
    { id: 'bear', label: 'Bear', emoji: '🐻' },
    { id: 'frog', label: 'Frog', emoji: '🐸' },
    { id: 'robot', label: 'Robot', emoji: '🤖' },
    { id: 'ghost', label: 'Ghost', emoji: '👻' },
    { id: 'sun', label: 'Sun', emoji: '🌞' },
    { id: 'spark', label: 'Spark', emoji: '✨' },
  ] as const

  const { copy, copied } = useClipboard()

  function mergeDiscoveries(items: ChatDiscoveryItem[], append: boolean): ChatDiscoveryItem[] {
    if (!append) {
      return items
    }

    const next = [...discoveries.value]
    const seen = new Set(next.map((item) => `${item.mediaKind}:${item.id}`))

    for (const item of items) {
      const key = `${item.mediaKind}:${item.id}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      next.push(item)
    }

    return next
  }

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
    if (isLocal && port !== '8787' && port !== '5173' && port !== '5174') {
      return 'Chat realtime cần chạy qua `pnpm dev` hoặc `pnpm dev:worker`.'
    }

    return ''
  })

  const activeAvatarPreset = computed(() => profile.value.avatarPreset)
  const avatarImageDataUrl = computed(() => profile.value.avatarImageDataUrl)

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

  function resetRealtimeState() {
    stopPing()
    socket.close()
    socketConnected.value = false
    socketPath.value = ''
  }

  function setProfileDraftName(value: string) {
    displayNameDraft.value = value
  }

  function setAvatarPreset(avatarPreset: string) {
    profile.value = {
      ...profile.value,
      avatarPreset,
    }
  }

  async function setAvatarImage(file: File | null) {
    if (!file) {
      profile.value = {
        ...profile.value,
        avatarImageDataUrl: null,
      }
      return
    }

    if (!file.type.startsWith('image/')) {
      errorMessage.value = 'Avatar phải là ảnh hợp lệ.'
      return
    }

    if (file.size > 1_500_000) {
      errorMessage.value = 'Avatar nên nhỏ hơn 1.5 MB để dùng mượt trên mobile.'
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      profile.value = {
        ...profile.value,
        avatarImageDataUrl: dataUrl,
      }
      errorMessage.value = ''
    } catch (error) {
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    }
  }

  function clearAvatarImage() {
    profile.value = {
      ...profile.value,
      avatarImageDataUrl: null,
    }
  }

  function buildIdentity(
    roomId: string,
    participantId: string,
    sessionId: string,
    displayName: string,
    avatarPreset: string | null,
  ): StoredChatRoomIdentity {
    return {
      participantId,
      sessionId,
      displayName,
      avatarPreset,
    }
  }

  function storeIdentity(roomId: string, identity: StoredChatRoomIdentity) {
    profile.value = {
      ...profile.value,
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
      avatarPreset: identity.avatarPreset,
      role,
      lastVisitedAt: Date.now(),
    }

    const next = savedRooms.value.filter((item) => item.roomId !== roomRecord.roomId)
    savedRooms.value = [nextEntry, ...next].slice(0, 24)
  }

  function removeSavedRoom(roomId: string) {
    savedRooms.value = savedRooms.value.filter((item) => item.roomId !== roomId)
  }

  function findSavedIdentity(roomId: string): StoredChatRoomIdentity | null {
    const storedIdentity = profile.value.rooms[roomId]
    if (storedIdentity) {
      return storedIdentity
    }

    const saved = savedRooms.value.find((item) => item.roomId === roomId)
    if (!saved) {
      return null
    }

    return {
      participantId: saved.participantId,
      sessionId: saved.sessionId,
      displayName: saved.displayName,
      avatarPreset: saved.avatarPreset,
    }
  }

  function applySocketMessage(message: ChatSocketServerMessage) {
    if (message.type === 'initial_state') {
      activeRoom.value = message.room
      roomPreview.value = message.room
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

  async function loadDiscoveries(kind = discoveryKind.value, append = false) {
    if (append) {
      if (isLoadingDiscoveries.value || isLoadingMoreDiscoveries.value) {
        return
      }
      isLoadingMoreDiscoveries.value = true
    } else {
      isLoadingDiscoveries.value = true
    }

    try {
      discoveryKind.value = kind
      const response = await getChatDiscoveries(kind, DISCOVERY_PAGE_SIZE)
      discoveries.value = mergeDiscoveries(response.discoveries, append)
    } catch (error) {
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    } finally {
      if (append) {
        isLoadingMoreDiscoveries.value = false
      } else {
        isLoadingDiscoveries.value = false
      }
    }
  }

  async function loadMoreDiscoveries() {
    await loadDiscoveries(discoveryKind.value, true)
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

  async function refreshRoomPreview(roomId: string) {
    try {
      const response = await getChatRoom(roomId)
      roomPreview.value = response.room
    } catch (error) {
      roomPreview.value = null
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

  function getDraftDisplayName(): string {
    return displayNameDraft.value.trim()
  }

  function requireDisplayName(): string | null {
    const displayName = getDraftDisplayName()
    if (!displayName) {
      errorMessage.value = 'Nhập tên người dùng trước đã.'
      return null
    }
    return displayName
  }

  async function connectToRoom(
    roomId: string,
    identityOverride: StoredChatRoomIdentity | null = null,
  ) {
    const savedIdentity = identityOverride ?? findSavedIdentity(roomId)
    const displayName = savedIdentity?.displayName ?? getDraftDisplayName()

    if (!displayName) {
      errorMessage.value = 'Nhập tên người dùng trước khi vào phòng.'
      return
    }

    isBusy.value = true
    errorMessage.value = ''

    try {
      const response = await joinChatRoom(roomId, {
        displayName,
        participantId: savedIdentity?.participantId ?? '',
        sessionId: savedIdentity?.sessionId ?? profile.value.globalSessionId,
        avatarPreset: savedIdentity?.avatarPreset ?? activeAvatarPreset.value ?? null,
      })

      if (!response.participant) {
        throw new Error('Không thể tham gia room này.')
      }

      const identity = buildIdentity(
        roomId,
        response.participant.participantId,
        response.participant.sessionId,
        response.participant.displayName,
        response.participant.avatarPreset,
      )

      storeIdentity(roomId, identity)
      activeRoom.value = response.room
      roomPreview.value = response.room
      upsertSavedRoom(response.room, identity)
      lastJoinedRoomId.value = roomId
      resetRealtimeState()
      socketPath.value = toChatWebSocketUrl(response.websocketUrl)
      socket.open()
    } catch (error) {
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    } finally {
      isBusy.value = false
    }
  }

  async function createRoom() {
    const displayName = requireDisplayName()
    const roomName = roomNameDraft.value.trim()
    if (!displayName) {
      return
    }

    if (!roomName) {
      errorMessage.value = 'Nhập tên phòng trước khi tạo.'
      return
    }

    isBusy.value = true
    errorMessage.value = ''

    try {
      const response = await createChatRoom({
        displayName,
        roomName,
        avatarPreset: activeAvatarPreset.value ?? null,
      })

      const identity = buildIdentity(
        response.roomId,
        response.host.participantId,
        response.host.sessionId,
        response.host.displayName,
        response.host.avatarPreset,
      )

      storeIdentity(response.roomId, identity)
      upsertSavedRoom(response.room, identity)
      inviteCodeDraft.value = response.roomId
      setRoomQuery(response.roomId)
      await connectToRoom(response.roomId, identity)
    } catch (error) {
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    } finally {
      isBusy.value = false
    }
  }

  async function joinRoomFromInvite() {
    const roomId = inviteCodeDraft.value.trim()
    if (!roomId) {
      errorMessage.value = 'Nhập mã phòng hoặc mở link mời.'
      return
    }

    if (!requireDisplayName()) {
      return
    }

    if (currentRoomId.value !== roomId) {
      setRoomQuery(roomId)
    }

    await connectToRoom(roomId)
  }

  async function openSavedRoom(roomId: string) {
    inviteCodeDraft.value = roomId
    if (currentRoomId.value !== roomId) {
      setRoomQuery(roomId)
    }

    await connectToRoom(roomId)
  }

  async function leaveRoom() {
    const roomId = currentRoomId.value
    const identity = activeIdentity.value

    resetRealtimeState()

    if (roomId && identity) {
      try {
        await leaveChatRoom(roomId, { participantId: identity.participantId })
      } catch {
        // Ignore leave failures during teardown.
      }
    }

    activeRoom.value = null
    activeIdentity.value = null
    roomPreview.value = null
    lastJoinedRoomId.value = ''
    composerPanel.value = 'none'
    messageDraft.value = ''
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
          item.mediaKind === 'video' ? null : item.imageUrl,
        ),
      }),
    )
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
        roomPreview.value = null
        resetRealtimeState()
        return
      }

      inviteCodeDraft.value = roomId
      activeIdentity.value = findSavedIdentity(roomId)
      composerPanel.value = 'none'

      if (activeIdentity.value && roomId !== lastJoinedRoomId.value && !isBusy.value) {
        await connectToRoom(roomId, activeIdentity.value)
        return
      }

      if (!activeIdentity.value) {
        await refreshRoomPreview(roomId)
      }
    },
    { immediate: true },
  )

  syncSavedRooms()

  onBeforeUnmount(() => {
    resetRealtimeState()
  })

  return {
    profile,
    savedRooms,
    displayNameDraft,
    roomNameDraft,
    inviteCodeDraft,
    messageDraft,
    activeRoom,
    roomPreview,
    activeIdentity,
    errorMessage,
    isBusy,
    discoveries,
    yahooEmoticons,
    filteredYahooEmoticons,
    yahooSearch,
    discoveryKind,
    composerPanel,
    isLoadingDiscoveries,
    isLoadingMoreDiscoveries,
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
    avatarPresets,
    activeAvatarPreset,
    avatarImageDataUrl,
    setProfileDraftName,
    setAvatarPreset,
    setAvatarImage,
    clearAvatarImage,
    createRoom,
    joinRoomFromInvite,
    openSavedRoom,
    leaveRoom,
    sendTextMessage,
    sendYahooIconMessage,
    sendMemeMessage,
    copyInviteLink,
    loadDiscoveries,
    loadMoreDiscoveries,
    refreshRoomPreview,
    syncSavedRooms,
    markTyping,
    openComposerPanel,
  }
}
