import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClipboard, useDebounceFn, useNow, useOnline } from '@vueuse/core'
import {
  createChatRoom,
  getChatDiscoveries,
  getChatRoom,
  getYahooEmoticons,
  joinChatRoom,
  leaveChatRoom,
} from '../api/client'
import type { ChatSocket } from '../api/ws'
import { connectChatSocket, onChatSocketMessage, sendChatSocketMessage } from '../api/ws'
import type {
  ChatDiscoveryItem,
  ChatMediaAttachment,
  ChatRoomRecord,
  ChatSocketClientMessage,
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
  const { copy, copied } = useClipboard()

  const profile = ref<StoredChatProfile>(createDefaultProfile())
  const savedRooms = ref<StoredChatSavedRoom[]>([])
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
  const socketConnected = ref(false)
  const composerPanel = ref<ComposerPanel>('none')
  const socketRef = shallowRef<ChatSocket | null>(null)

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
    return 'Chạy `pnpm dev` để dùng app + realtime server cùng lúc.'
  })

  const activeAvatarPreset = computed(() => profile.value.avatarPreset)
  const avatarImageDataUrl = computed(() => profile.value.avatarImageDataUrl)

  const sendTypingSignal = useDebounceFn(
    () => {
      if (!socketRef.value) {
        return
      }
      sendChatEvent({ type: 'typing' })
    },
    350,
    { maxWait: 1500 },
  )

  function sendChatEvent(message: ChatSocketClientMessage) {
    if (!socketRef.value) {
      return
    }
    sendChatSocketMessage(socketRef.value, message)
  }

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
    socketRef.value?.disconnect()
    socketRef.value = null
    socketConnected.value = false
  }

  function setProfileDraftName(value: string) {
    displayNameDraft.value = value
    profile.value = {
      ...profile.value,
      displayName: value,
    }
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

  function applySocketMessage(message: ChatSocketServerMessage) {
    if (message.type === 'initial_state') {
      activeRoom.value = message.room
      roomPreview.value = message.room
      return
    }

    if (!activeRoom.value) {
      return
    }

    if (message.type === 'participant_joined') {
      const next = [...activeRoom.value.participants]
      const index = next.findIndex(
        (participant) => participant.participantId === message.participant.participantId,
      )
      if (index === -1) {
        next.push(message.participant)
      } else {
        next[index] = message.participant
      }
      activeRoom.value = { ...activeRoom.value, participants: next }
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
      errorMessage.value = 'Room này đã hết hạn và sẽ đóng.'
      leaveRoom()
      return
    }

    if (message.type === 'action_rejected') {
      errorMessage.value = message.reason
    }
  }

  function bindSocket(roomId: string, identity: StoredChatRoomIdentity) {
    resetRealtimeState()
    const socket = connectChatSocket(roomId, identity)
    socketRef.value = socket

    socket.on('connect', () => {
      socketConnected.value = true
      errorMessage.value = ''
      sendChatEvent({ type: 'hello' })
    })

    socket.on('disconnect', () => {
      socketConnected.value = false
    })

    socket.on('connect_error', () => {
      socketConnected.value = false
      errorMessage.value = 'Kết nối realtime đang gặp sự cố.'
    })

    onChatSocketMessage(socket, applySocketMessage)
  }

  function mergeDiscoveries(items: ChatDiscoveryItem[], append: boolean) {
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
      errorMessage.value = getErrorMessage(error instanceof Error ? error : String(error))
    }
  }

  function syncSavedRooms() {
    savedRooms.value = []
  }

  function requireDisplayName() {
    const displayName = displayNameDraft.value.trim()
    if (!displayName) {
      errorMessage.value = 'Nhập tên người dùng trước đã.'
      return null
    }
    return displayName
  }

  async function connectToRoom(roomId: string) {
    const displayName = requireDisplayName()
    if (!displayName) {
      return
    }

    isBusy.value = true
    errorMessage.value = ''

    try {
      const response = await joinChatRoom(roomId, {
        displayName,
        participantId: activeIdentity.value?.participantId ?? '',
        sessionId: activeIdentity.value?.sessionId ?? profile.value.globalSessionId,
        avatarPreset: activeAvatarPreset.value ?? null,
      })

      if (!response.participant) {
        throw new Error('Không thể tham gia room này.')
      }

      const identity = buildIdentity(
        response.participant.participantId,
        response.participant.sessionId,
        response.participant.displayName,
        response.participant.avatarPreset,
      )

      activeIdentity.value = identity
      activeRoom.value = response.room
      roomPreview.value = response.room
      bindSocket(roomId, identity)
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
        response.host.participantId,
        response.host.sessionId,
        response.host.displayName,
        response.host.avatarPreset,
      )

      inviteCodeDraft.value = response.roomId
      activeIdentity.value = identity
      activeRoom.value = response.room
      roomPreview.value = response.room
      setRoomQuery(response.roomId)
      bindSocket(response.roomId, identity)
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
    if (currentRoomId.value !== roomId) {
      setRoomQuery(roomId)
    }
    await connectToRoom(roomId)
  }

  async function openSavedRoom(roomId: string) {
    inviteCodeDraft.value = roomId
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
        // ignore
      }
    }

    activeRoom.value = null
    activeIdentity.value = null
    roomPreview.value = null
    composerPanel.value = 'none'
    messageDraft.value = ''
    setRoomQuery('')
  }

  function sendTextMessage() {
    const text = messageDraft.value.trim()
    if (!text || !socketConnected.value) {
      return
    }
    sendChatEvent({
      type: 'send_message',
      kind: 'text',
      text,
    })
    messageDraft.value = ''
  }

  function sendYahooIconMessage(item: YahooEmoticon) {
    if (!socketConnected.value) {
      return
    }
    sendChatEvent({
      type: 'send_message',
      kind: 'icon',
      icon: buildAttachment(item.id, item.title, item.imageUrl, 'gif', null, item.imageUrl),
    })
    composerPanel.value = 'none'
  }

  function sendMemeMessage(item: ChatDiscoveryItem) {
    if (!socketConnected.value) {
      return
    }
    sendChatEvent({
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
    })
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
        roomPreview.value = null
        return
      }
      inviteCodeDraft.value = roomId
      if (!activeRoom.value || activeRoom.value.roomId !== roomId) {
        await refreshRoomPreview(roomId)
      }
    },
    { immediate: true },
  )

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
