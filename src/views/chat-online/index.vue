<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useChatOnlineRoom } from './composables/useChatOnlineRoom'
import type { ChatMessage, YahooEmoticon } from './api/types'

const DISCOVERY_KINDS: Array<'mixed' | 'image' | 'gif'> = ['mixed', 'image', 'gif']

interface TextSegment {
  type: 'text' | 'icon'
  value: string
  emoticon?: YahooEmoticon
}

const room = useChatOnlineRoom()
const messagesContainer = ref<HTMLElement | null>(null)
const isSettingsOpen = ref(false)
const isParticipantsOpen = ref(false)
const isNearBottom = ref(true)
const unreadCount = ref(0)

const sortedMessages = computed<ChatMessage[]>(() => room.activeRoom.value?.messages ?? [])
const participantLabel = computed(() => {
  const total = room.activeRoom.value?.participants.length ?? 0
  const online = room.onlineParticipants.value.length
  return `${online}/${total} online`
})
const totalParticipants = computed(() => room.activeRoom.value?.participants.length ?? 0)
const onlineCount = computed(() => room.onlineParticipants.value.length)
const awayCount = computed(() => Math.max(totalParticipants.value - onlineCount.value, 0))
const onlineRoster = computed(() =>
  (room.activeRoom.value?.participants ?? [])
    .filter((participant) => participant.connected)
    .sort((left, right) => Number(right.isHost) - Number(left.isHost) || left.joinedAt - right.joinedAt),
)
const awayRoster = computed(() =>
  (room.activeRoom.value?.participants ?? [])
    .filter((participant) => !participant.connected)
    .sort((left, right) => Number(right.isHost) - Number(left.isHost) || left.joinedAt - right.joinedAt),
)

const emoticonEntries = computed(() => [...room.yahooEmoticons.value].sort((a, b) => b.code.length - a.code.length))
const emoticonMap = computed(() => new Map(emoticonEntries.value.map((item) => [item.code, item])))

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseTextSegments(text: string): TextSegment[] {
  if (!text || !emoticonEntries.value.length) return [{ type: 'text', value: text }]
  const pattern = new RegExp(emoticonEntries.value.map((item) => escapeRegExp(item.code)).join('|'), 'g')
  const segments: TextSegment[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const code = match[0]
    const index = match.index ?? 0
    if (index > cursor) segments.push({ type: 'text', value: text.slice(cursor, index) })
    const emoticon = emoticonMap.value.get(code)
    segments.push(emoticon ? { type: 'icon', value: code, emoticon } : { type: 'text', value: code })
    cursor = index + code.length
  }
  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) })
  return segments.length ? segments : [{ type: 'text', value: text }]
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function isMine(message: ChatMessage): boolean {
  return message.participantId === room.activeIdentity.value?.participantId
}

function isAnimatedMessage(message: ChatMessage): boolean {
  return message.kind === 'meme' && message.attachment?.mediaKind === 'video'
}

function getParticipantInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) {
    return '?'
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function getParticipantTone(participantId: string): string {
  const tones: readonly [string, string, string, string, string, string] = [
    'from-[rgba(231,111,81,0.22)] to-[rgba(255,250,244,0.95)] text-accent-coral',
    'from-[rgba(216,155,29,0.22)] to-[rgba(255,250,244,0.95)] text-accent-amber',
    'from-[rgba(58,124,165,0.22)] to-[rgba(255,250,244,0.95)] text-accent-sky',
    'from-[rgba(231,111,81,0.16)] to-[rgba(251,231,211,0.92)] text-accent-coral',
    'from-[rgba(216,155,29,0.16)] to-[rgba(251,231,211,0.92)] text-accent-amber',
    'from-[rgba(58,124,165,0.16)] to-[rgba(251,231,211,0.92)] text-accent-sky',
  ]
  let seed = 0
  for (const character of participantId) {
    seed += character.charCodeAt(0)
  }
  return tones[seed % tones.length] ?? tones[0]
}

function updateScrollState() {
  const element = messagesContainer.value
  if (!element) {
    isNearBottom.value = true
    return
  }

  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight
  isNearBottom.value = distanceToBottom < 80

  if (isNearBottom.value) {
    unreadCount.value = 0
  }
}

async function scrollMessagesToBottom(behavior: ScrollBehavior = 'auto') {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior,
    })
    updateScrollState()
  }
}

function jumpToLatest() {
  unreadCount.value = 0
  return scrollMessagesToBottom('smooth')
}

function toggleSettings() {
  isSettingsOpen.value = !isSettingsOpen.value
  if (isSettingsOpen.value) isParticipantsOpen.value = false
}

function toggleParticipants() {
  isParticipantsOpen.value = !isParticipantsOpen.value
  if (isParticipantsOpen.value) isSettingsOpen.value = false
}

useEventListener(messagesContainer, 'scroll', updateScrollState, { passive: true })

watch(
  () => sortedMessages.value.length,
  async (nextLength, previousLength = 0) => {
    const lastMessage = sortedMessages.value[sortedMessages.value.length - 1] ?? null
    const isMyMessage = lastMessage?.participantId === room.activeIdentity.value?.participantId

    if (!previousLength || isNearBottom.value || isMyMessage) {
      await scrollMessagesToBottom(previousLength ? 'smooth' : 'auto')
      return
    }

    if (nextLength > previousLength) {
      unreadCount.value += nextLength - previousLength
    }
  },
  { immediate: true },
)

watch(() => room.activeRoom.value?.roomId, async () => {
  isSettingsOpen.value = false
  isParticipantsOpen.value = false
  unreadCount.value = 0
  isNearBottom.value = true
  await scrollMessagesToBottom()
})
</script>

<template>
  <div class="h-screen overflow-hidden bg-bg-deep text-text-primary font-body">
    <div class="mx-auto flex h-full max-w-7xl flex-col px-3 py-4 sm:px-5 sm:py-5">
      <main class="flex h-[calc(100vh-2rem)] flex-1 flex-col overflow-hidden border border-border-default bg-bg-surface">
        <header class="flex flex-col gap-3 border-b border-border-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div class="min-w-0">
            <p class="text-[11px] uppercase tracking-[0.28em] text-accent-coral">// Chat Online</p>
            <h1 class="mt-1 truncate font-display text-xl font-semibold sm:text-3xl">{{ room.activeRoom.value?.roomName || 'Sunlit Friend Room' }}</h1>
            <p class="mt-1 text-xs text-text-secondary sm:text-sm">{{ room.activeRoom.value ? `${participantLabel} · ${room.connectionLabel.value}` : 'Tạo room mới, tham gia bằng mã hoặc mở lại phòng cũ của bạn.' }}</p>
          </div>

          <div class="flex w-full items-center justify-end gap-2 sm:w-auto">
            <RouterLink to="/" class="inline-flex items-center justify-center border border-border-default bg-bg-elevated p-2 text-text-secondary transition hover:border-accent-coral hover:text-accent-coral">
              <Icon icon="lucide:home" class="size-4" />
            </RouterLink>
            <button v-if="room.activeRoom.value" class="inline-flex items-center justify-center border border-border-default bg-bg-elevated p-2 text-text-secondary transition hover:border-accent-sky hover:text-accent-sky" @click="toggleParticipants">
              <Icon icon="lucide:users" class="size-4" />
            </button>
            <button class="inline-flex items-center justify-center border border-border-default bg-bg-elevated p-2 text-text-secondary transition hover:border-accent-sky hover:text-accent-sky" @click="toggleSettings">
              <Icon icon="lucide:settings-2" class="size-4" />
            </button>
          </div>
        </header>

        <div class="relative flex min-h-0 flex-1 overflow-hidden">
          <div class="flex min-h-0 flex-1 flex-col">
            <section v-if="!room.activeRoom.value" class="grid flex-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
              <div class="border border-border-default bg-[linear-gradient(180deg,rgba(255,250,244,0.3)_0%,rgba(251,231,211,0.5)_100%)] p-5">
                <h2 class="font-display text-3xl font-semibold sm:text-4xl">Chat room cho bạn bè</h2>
                <p class="mt-3 text-sm leading-7 text-text-secondary">Yahoo icon, animated meme, ảnh, video và link mời nhanh trong cùng một khung chat.</p>
                <div class="mt-5 grid gap-4 md:grid-cols-2">
                  <input v-model="room.profile.value.displayName" type="text" maxlength="24" placeholder="Nickname" class="border border-border-default bg-bg-surface px-3 py-3 text-sm outline-none transition focus:border-accent-coral" />
                  <input v-model="room.roomNameDraft.value" type="text" maxlength="48" placeholder="Tên room mới" class="border border-border-default bg-bg-surface px-3 py-3 text-sm outline-none transition focus:border-accent-coral" />
                </div>
                <div class="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button class="inline-flex w-full items-center justify-center gap-2 border border-accent-coral bg-accent-coral px-5 py-3 text-sm font-semibold text-bg-surface transition hover:bg-accent-coral/90 disabled:opacity-60 sm:w-auto" :disabled="room.isBusy.value" @click="room.createRoom"><Icon icon="lucide:plus" class="size-4" />Tạo room</button>
                  <div class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
                    <input v-model="room.inviteCodeDraft.value" type="text" placeholder="Nhập mã room" class="min-w-0 flex-1 border border-border-default bg-bg-surface px-3 py-3 text-sm outline-none transition focus:border-accent-sky" />
                    <button class="inline-flex w-full items-center justify-center gap-2 border border-border-default bg-bg-elevated px-4 py-3 text-sm font-semibold text-text-primary transition hover:border-accent-sky hover:text-accent-sky disabled:opacity-60 sm:w-auto" :disabled="room.isBusy.value" @click="room.joinRoomFromInvite"><Icon icon="lucide:door-open" class="size-4" />Vào</button>
                  </div>
                </div>
                <p v-if="room.environmentHint.value" class="mt-4 text-sm text-accent-amber">{{ room.environmentHint.value }}</p>
              </div>

              <div class="border border-border-default bg-bg-elevated p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="font-display text-2xl font-semibold">Phòng đã lưu</h2>
                  <button class="inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-sky hover:text-accent-sky disabled:opacity-60" :disabled="room.isSyncingSavedRooms.value" @click="room.syncSavedRooms"><Icon icon="lucide:refresh-cw" class="size-3.5" />Sync</button>
                </div>
                <div v-if="room.savedRooms.value.length" class="chat-scroll mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                  <button v-for="saved in room.savedRooms.value" :key="saved.roomId" class="w-full border border-border-default bg-bg-surface p-4 text-left transition hover:border-accent-coral" @click="room.openSavedRoom(saved.roomId)">
                    <div class="font-display text-lg font-semibold">{{ saved.roomName }}</div>
                    <div class="mt-1 text-xs uppercase tracking-[0.18em] text-text-dim">{{ saved.role }} · {{ saved.roomId }}</div>
                  </button>
                </div>
                <div v-else class="mt-4 border border-dashed border-border-default bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary">Chưa có phòng nào được lưu trong trình duyệt này.</div>
              </div>
            </section>

            <template v-else>
              <div class="relative min-h-0 flex-1">
                <div ref="messagesContainer" class="chat-scroll min-h-0 h-full space-y-4 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,rgba(255,250,244,0.35)_0%,rgba(251,231,211,0.48)_100%)] p-4 sm:p-5">
                <div v-for="message in sortedMessages" :key="message.messageId" class="flex" :class="isMine(message) ? 'justify-end' : 'justify-start'">
                  <article class="max-w-[88%] border px-4 py-3 sm:max-w-[72%]" :class="isMine(message) ? 'border-accent-coral bg-[rgba(231,111,81,0.1)]' : 'border-border-default bg-bg-surface'">
                    <div class="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-text-dim"><span>{{ message.displayName }}</span><span>{{ formatTime(message.createdAt) }}</span></div>

                    <div v-if="message.kind === 'text'" class="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-text-primary">
                      <template v-for="(segment, index) in parseTextSegments(message.text)" :key="`${message.messageId}-${index}`">
                        <span v-if="segment.type === 'text'">{{ segment.value }}</span>
                        <img v-else-if="segment.emoticon" :src="segment.emoticon.imageUrl" :alt="segment.emoticon.title" class="mx-0.5 inline-block h-5 w-5 align-[-0.3rem] sm:h-6 sm:w-6" loading="lazy" />
                      </template>
                    </div>

                    <div v-else-if="message.kind === 'icon' && message.attachment" class="mt-3">
                      <img :src="message.attachment.mediaUrl" :alt="message.attachment.title" class="h-10 w-10 object-contain sm:h-12 sm:w-12" loading="lazy" />
                    </div>

                    <div v-else-if="message.attachment && isAnimatedMessage(message)" class="mt-3 inline-flex max-w-full border border-border-default bg-bg-elevated p-3">
                      <video :src="message.attachment.mediaUrl" class="max-h-80 w-auto max-w-full border border-border-default object-contain" autoplay loop muted playsinline />
                    </div>

                    <div v-else-if="message.kind === 'video' && message.attachment" class="mt-3 inline-flex max-w-full border border-border-default bg-bg-elevated p-3">
                      <video :src="message.attachment.mediaUrl" class="max-h-80 w-auto max-w-full border border-border-default object-contain" controls preload="metadata" />
                    </div>

                    <a v-else-if="message.attachment" :href="message.attachment.pageUrl || message.attachment.mediaUrl" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex max-w-full border border-border-default bg-bg-elevated p-3 transition hover:border-accent-sky">
                      <img :src="message.attachment.previewUrl || message.attachment.mediaUrl" :alt="message.attachment.title" class="max-h-80 w-auto max-w-full border border-border-default object-contain" loading="lazy" />
                    </a>
                  </article>
                </div>

                <div v-if="room.typingParticipants.value.length" class="border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-secondary">{{ room.typingParticipants.value.map((participant) => participant.displayName).join(', ') }} đang gõ...</div>
                </div>

                <div v-if="!isNearBottom" class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 sm:bottom-4 sm:px-4">
                  <button class="pointer-events-auto inline-flex min-h-11 w-full max-w-xs items-center justify-center gap-2 border border-accent-coral bg-bg-surface px-4 py-2 text-sm font-semibold text-accent-coral shadow-[0_14px_32px_rgba(47,36,31,0.12)] transition hover:bg-bg-elevated sm:w-auto" @click="jumpToLatest">
                    <Icon icon="lucide:arrow-down" class="size-4" />
                    <span>{{ unreadCount ? `Có ${unreadCount} tin mới` : 'Về cuối chat' }}</span>
                  </button>
                </div>
              </div>

              <div class="border-t border-border-default p-3 sm:p-4">
                <div v-if="room.errorMessage.value" class="mb-3 border border-accent-coral bg-[rgba(231,111,81,0.08)] px-4 py-3 text-sm text-accent-coral">{{ room.errorMessage.value }}</div>
                <div class="grid grid-cols-1 gap-2 border border-border-default bg-bg-elevated p-3 sm:grid-cols-3">
                  <button class="inline-flex min-h-11 items-center justify-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.18em] transition" :class="room.composerPanel.value === 'yahoo' ? 'border-accent-coral bg-[rgba(231,111,81,0.1)] text-accent-coral' : 'border-border-default bg-bg-surface text-text-secondary hover:text-text-primary'" @click="room.openComposerPanel('yahoo')"><Icon icon="lucide:smile-plus" class="size-3.5" />Yahoo</button>
                  <button class="inline-flex min-h-11 items-center justify-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.18em] transition" :class="room.composerPanel.value === 'discoveries' ? 'border-accent-amber bg-[rgba(216,155,29,0.1)] text-accent-amber' : 'border-border-default bg-bg-surface text-text-secondary hover:text-text-primary'" @click="room.openComposerPanel('discoveries')"><Icon icon="lucide:gallery-horizontal" class="size-3.5" />GIF / Meme</button>
                  <button class="inline-flex min-h-11 items-center justify-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.18em] transition" :class="room.composerPanel.value === 'media' ? 'border-accent-sky bg-[rgba(58,124,165,0.1)] text-accent-sky' : 'border-border-default bg-bg-surface text-text-secondary hover:text-text-primary'" @click="room.openComposerPanel('media')"><Icon icon="lucide:image-plus" class="size-3.5" />Ảnh / Video</button>
                </div>

                <div v-if="room.composerPanel.value === 'yahoo'" class="mt-3 border border-border-default bg-bg-elevated p-4">
                  <input v-model="room.yahooSearch.value" type="text" placeholder="Tìm theo tên hoặc mã như =))" class="w-full border border-border-default bg-bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent-coral" />
                  <div class="chat-scroll mt-4 grid max-h-60 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 lg:grid-cols-8">
                    <button v-for="item in room.filteredYahooEmoticons.value" :key="item.id" class="group border border-border-default bg-bg-surface p-2 transition hover:border-accent-coral hover:bg-[rgba(231,111,81,0.06)]" @click="room.sendYahooIconMessage(item)">
                      <img :src="item.imageUrl" :alt="item.title" class="mx-auto h-8 w-8 object-contain" loading="lazy" />
                      <div class="mt-2 truncate text-[10px] uppercase tracking-[0.18em] text-text-dim group-hover:text-accent-coral">{{ item.code }}</div>
                    </button>
                  </div>
                </div>

                <div v-if="room.composerPanel.value === 'discoveries'" class="mt-3 border border-border-default bg-bg-elevated p-4">
                  <div class="flex gap-2">
                    <button v-for="kind in DISCOVERY_KINDS" :key="kind" class="border px-3 py-2 text-xs uppercase tracking-[0.2em] transition" :class="room.discoveryKind.value === kind ? 'border-accent-amber bg-[rgba(216,155,29,0.1)] text-accent-amber' : 'border-border-default bg-bg-surface text-text-dim hover:text-text-primary'" @click="room.loadDiscoveries(kind)">{{ kind }}</button>
                  </div>
                  <div class="chat-scroll mt-4 grid max-h-64 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                    <button v-for="item in room.discoveries.value" :key="`${item.mediaKind}-${item.id}`" class="border border-border-default bg-bg-surface p-3 text-left transition hover:border-accent-amber" @click="room.sendMemeMessage(item)">
                      <img v-if="item.mediaKind !== 'video'" :src="item.imageUrl" :alt="item.title" class="h-28 w-full border border-border-default object-cover" loading="lazy" />
                      <video v-else :src="item.imageUrl" class="h-28 w-full border border-border-default object-cover" autoplay loop muted playsinline />
                      <div class="mt-3 line-clamp-2 text-sm font-semibold text-text-primary">{{ item.title }}</div>
                    </button>
                  </div>
                </div>

                <div v-if="room.composerPanel.value === 'media'" class="mt-3 border border-border-default bg-bg-elevated p-4">
                  <div class="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <select v-model="room.mediaKindDraft.value" class="border border-border-default bg-bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent-sky"><option value="image">Image URL</option><option value="video">Video URL</option></select>
                    <input v-model="room.mediaUrlDraft.value" type="url" placeholder="https://... media file" class="border border-border-default bg-bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent-sky" />
                    <input v-model="room.mediaTitleDraft.value" type="text" maxlength="80" placeholder="Caption / tiêu đề" class="border border-border-default bg-bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent-sky" />
                    <button class="inline-flex min-h-11 items-center justify-center gap-2 border border-accent-sky bg-accent-sky px-4 py-2 text-sm font-semibold text-bg-surface transition hover:bg-accent-sky/90 disabled:opacity-60" :disabled="!room.mediaUrlDraft.value.trim()" @click="room.sendMediaMessage"><Icon icon="lucide:upload" class="size-4" />Gửi</button>
                  </div>
                </div>

                <div class="mt-3 flex flex-col gap-3">
                  <textarea v-model="room.messageDraft.value" rows="2" placeholder="Gõ =)), :D, :-h... để tự hiện icon khi gửi" class="min-h-24 w-full resize-none border border-border-default bg-bg-elevated px-4 py-3 text-sm leading-7 outline-none transition focus:border-accent-coral disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-28" :disabled="!room.socketConnected.value" @input="room.markTyping" @keydown.enter.exact.prevent="room.sendTextMessage" />
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="text-xs uppercase tracking-[0.2em] text-text-dim">Enter để gửi, Shift + Enter để xuống dòng</div>
                    <button class="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-accent-coral bg-accent-coral px-5 py-3 text-sm font-semibold text-bg-surface transition hover:bg-accent-coral/90 disabled:opacity-60 sm:w-auto" :disabled="!room.socketConnected.value || !room.messageDraft.value.trim()" @click="room.sendTextMessage"><Icon icon="lucide:send" class="size-4" />Gửi tin nhắn</button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="translate-x-full opacity-0" enter-to-class="translate-x-0 opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="translate-x-0 opacity-100" leave-to-class="translate-x-full opacity-0">
            <aside v-if="isSettingsOpen" class="absolute inset-y-0 right-0 z-20 flex w-full max-w-none flex-col border-l border-border-default bg-bg-surface shadow-2xl sm:max-w-sm xl:w-[22rem]">
              <div class="flex items-center justify-between border-b border-border-default px-4 py-3">
                <div><div class="text-xs uppercase tracking-[0.22em] text-text-dim">Settings</div><div class="mt-1 font-display text-xl font-semibold">Chat Info</div></div>
                <button class="inline-flex items-center justify-center border border-border-default bg-bg-elevated p-2 text-text-secondary transition hover:border-accent-coral hover:text-accent-coral" @click="isSettingsOpen = false"><Icon icon="lucide:x" class="size-4" /></button>
              </div>
              <div class="chat-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <section class="border border-border-default bg-bg-elevated p-4">
                  <div class="text-xs uppercase tracking-[0.2em] text-text-dim">Connection</div>
                  <div class="mt-2 text-sm font-semibold text-text-primary">{{ room.connectionLabel.value }}</div>
                  <div class="mt-1 text-sm text-text-secondary">TTL: {{ room.expiresInLabel.value }}</div>
                </section>
                <section v-if="room.activeRoom.value" class="border border-border-default bg-bg-elevated p-4">
                  <div class="text-xs uppercase tracking-[0.2em] text-text-dim">Room</div>
                  <div class="mt-2 font-display text-2xl font-semibold">{{ room.activeRoom.value.roomName }}</div>
                  <div class="mt-1 font-mono text-sm text-text-secondary">{{ room.activeRoom.value.roomId }}</div>
                  <button class="mt-3 inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-amber hover:text-accent-amber" @click="room.copyInviteLink"><Icon :icon="room.copied.value ? 'lucide:check' : 'lucide:copy'" class="size-3.5" />{{ room.copied.value ? 'Đã copy link' : 'Copy link mời' }}</button>
                </section>
                <section class="border border-border-default bg-bg-elevated p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div><div class="text-xs uppercase tracking-[0.2em] text-text-dim">Saved Rooms</div><div class="mt-1 text-sm text-text-secondary">Các phòng chưa bị xóa trong local browser.</div></div>
                    <button class="inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-sky hover:text-accent-sky disabled:opacity-60" :disabled="room.isSyncingSavedRooms.value" @click="room.syncSavedRooms"><Icon icon="lucide:refresh-cw" class="size-3.5" />Sync</button>
                  </div>
                  <div v-if="room.savedRooms.value.length" class="chat-scroll mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                    <button v-for="saved in room.savedRooms.value" :key="saved.roomId" class="w-full border border-border-default bg-bg-surface p-3 text-left transition hover:border-accent-coral" @click="room.openSavedRoom(saved.roomId)">
                      <div class="font-semibold text-text-primary">{{ saved.roomName }}</div>
                      <div class="mt-1 text-xs uppercase tracking-[0.18em] text-text-dim">{{ saved.role }} · {{ saved.roomId }}</div>
                    </button>
                  </div>
                  <div v-else class="mt-4 text-sm text-text-secondary">Chưa có room nào được lưu.</div>
                </section>
              </div>
            </aside>
          </Transition>

          <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="translate-x-full opacity-0" enter-to-class="translate-x-0 opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="translate-x-0 opacity-100" leave-to-class="translate-x-full opacity-0">
            <aside v-if="isParticipantsOpen && room.activeRoom.value" class="absolute inset-y-0 right-0 z-20 flex w-full max-w-none flex-col border-l border-border-default bg-bg-surface shadow-2xl sm:max-w-sm xl:w-[22rem]">
              <div class="flex items-center justify-between border-b border-border-default px-4 py-3">
                <div><div class="text-xs uppercase tracking-[0.22em] text-text-dim">Participants</div><div class="mt-1 font-display text-xl font-semibold">{{ participantLabel }}</div></div>
                <button class="inline-flex items-center justify-center border border-border-default bg-bg-elevated p-2 text-text-secondary transition hover:border-accent-coral hover:text-accent-coral" @click="isParticipantsOpen = false"><Icon icon="lucide:x" class="size-4" /></button>
              </div>
              <div class="chat-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                <div class="grid grid-cols-3 gap-2">
                  <div class="border border-border-default bg-bg-elevated px-3 py-3 text-center">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Total</div>
                    <div class="mt-2 font-display text-2xl font-semibold text-text-primary">{{ totalParticipants }}</div>
                  </div>
                  <div class="border border-border-default bg-bg-elevated px-3 py-3 text-center">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Online</div>
                    <div class="mt-2 font-display text-2xl font-semibold text-accent-sky">{{ onlineCount }}</div>
                  </div>
                  <div class="border border-border-default bg-bg-elevated px-3 py-3 text-center">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Away</div>
                    <div class="mt-2 font-display text-2xl font-semibold text-accent-amber">{{ awayCount }}</div>
                  </div>
                </div>

                <section v-if="onlineRoster.length" class="space-y-3">
                  <div class="flex items-center justify-between border-b border-border-default pb-2">
                    <div class="text-xs uppercase tracking-[0.18em] text-accent-sky">Online</div>
                    <div class="text-xs text-text-dim">{{ onlineCount }} người</div>
                  </div>

                  <div v-for="participant in onlineRoster" :key="participant.participantId" class="border border-border-default bg-bg-elevated p-3">
                    <div class="flex items-center gap-3">
                      <div class="flex size-11 shrink-0 items-center justify-center border border-border-default bg-gradient-to-br text-sm font-display font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]" :class="getParticipantTone(participant.participantId)">
                        {{ getParticipantInitials(participant.displayName) }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <div class="truncate font-semibold text-text-primary">{{ participant.displayName }}</div>
                          <span v-if="participant.isHost" class="border border-accent-coral/30 bg-accent-coral/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-accent-coral">Host</span>
                        </div>
                        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
                          <span>{{ formatTime(participant.joinedAt) }}</span>
                          <span>Đang online</span>
                        </div>
                      </div>
                      <div class="inline-flex items-center gap-2 border border-accent-sky px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-accent-sky">
                        <span class="size-2 bg-accent-sky" />
                        online
                      </div>
                    </div>
                  </div>
                </section>

                <section v-if="awayRoster.length" class="space-y-3">
                  <div class="flex items-center justify-between border-b border-border-default pb-2">
                    <div class="text-xs uppercase tracking-[0.18em] text-accent-amber">Away</div>
                    <div class="text-xs text-text-dim">{{ awayCount }} người</div>
                  </div>

                  <div v-for="participant in awayRoster" :key="participant.participantId" class="border border-border-default bg-bg-elevated/80 p-3">
                    <div class="flex items-center gap-3 opacity-85">
                      <div class="flex size-11 shrink-0 items-center justify-center border border-border-default bg-gradient-to-br text-sm font-display font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" :class="getParticipantTone(participant.participantId)">
                        {{ getParticipantInitials(participant.displayName) }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <div class="truncate font-semibold text-text-primary">{{ participant.displayName }}</div>
                          <span v-if="participant.isHost" class="border border-accent-coral/25 bg-accent-coral/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-accent-coral">Host</span>
                        </div>
                        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
                          <span>{{ formatTime(participant.joinedAt) }}</span>
                          <span>Tạm vắng</span>
                        </div>
                      </div>
                      <div class="inline-flex items-center gap-2 border border-border-default px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-text-dim">
                        <span class="size-2 bg-text-dim" />
                        away
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </aside>
          </Transition>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.chat-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(231, 111, 81, 0.78) rgba(251, 231, 211, 0.78);
}

.chat-scroll::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.chat-scroll::-webkit-scrollbar-track {
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.96), rgba(251, 231, 211, 0.82));
  border-left: 1px solid rgba(231, 212, 197, 0.92);
}

.chat-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(231, 111, 81, 0.95), rgba(216, 155, 29, 0.92));
  border: 2px solid rgba(255, 250, 244, 0.96);
  border-radius: 999px;
}

.chat-scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(231, 111, 81, 1), rgba(58, 124, 165, 0.94));
}

.chat-scroll::-webkit-scrollbar-corner {
  background: transparent;
}
</style>
