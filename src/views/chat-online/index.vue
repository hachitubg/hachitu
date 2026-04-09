<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useClipboard, useEventListener } from '@vueuse/core'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useChatOnlineRoom } from './composables/useChatOnlineRoom'
import type { ChatMessage, ChatParticipant, YahooEmoticon } from './api/types'

interface TextSegment {
  type: 'text' | 'icon'
  value: string
  emoticon?: YahooEmoticon
}

const DISCOVERY_KINDS: Array<'mixed' | 'image' | 'gif'> = ['mixed', 'image', 'gif']
const room = useChatOnlineRoom()
const messagesContainer = ref<HTMLElement | null>(null)
const discoveriesContainer = ref<HTMLElement | null>(null)
const avatarInput = ref<HTMLInputElement | null>(null)
const isSettingsOpen = ref(false)
const isParticipantsOpen = ref(false)
const isNearBottom = ref(true)
const unreadCount = ref(0)
const copiedMediaUrl = ref('')
const { copy: copyMediaToClipboard } = useClipboard()

const avatarPresetMap = computed(
  () =>
    new Map<string, (typeof room.avatarPresets)[number]>(
      room.avatarPresets.map((preset) => [preset.id, preset]),
    ),
)
const messages = computed(() => room.activeRoom.value?.messages ?? [])
const roomTitle = computed(
  () => room.activeRoom.value?.roomName ?? room.roomPreview.value?.roomName ?? 'Chat Online',
)
const participantLabel = computed(() => {
  const total = room.activeRoom.value?.participants.length ?? 0
  const online = room.onlineParticipants.value.length
  return `${online}/${total} online`
})
const emoticonEntries = computed(() =>
  [...room.yahooEmoticons.value].sort((a, b) => b.code.length - a.code.length),
)
const emoticonMap = computed(() => new Map(emoticonEntries.value.map((item) => [item.code, item])))

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseTextSegments(text: string): TextSegment[] {
  if (!text || !emoticonEntries.value.length) return [{ type: 'text', value: text }]
  const pattern = new RegExp(
    emoticonEntries.value.map((item) => escapeRegExp(item.code)).join('|'),
    'g',
  )
  const segments: TextSegment[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const code = match[0]
    const index = match.index ?? 0
    if (index > cursor) segments.push({ type: 'text', value: text.slice(cursor, index) })
    const emoticon = emoticonMap.value.get(code)
    segments.push(
      emoticon ? { type: 'icon', value: code, emoticon } : { type: 'text', value: code },
    )
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

function getParticipant(participantId: string): ChatParticipant | null {
  return (
    room.activeRoom.value?.participants.find(
      (participant) => participant.participantId === participantId,
    ) ?? null
  )
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.length ? parts.map((part) => part[0]?.toUpperCase() ?? '').join('') : '?'
}

function getAvatarEmoji(participant: ChatParticipant | null): string | null {
  if (!participant?.avatarPreset) return null
  return avatarPresetMap.value.get(participant.avatarPreset)?.emoji ?? null
}

function getPresetEmoji(avatarPreset: string | null | undefined): string {
  return avatarPresetMap.value.get(avatarPreset ?? 'fox')?.emoji ?? '🦊'
}

function getAvatarImage(participant: ChatParticipant | null): string | null {
  if (participant?.participantId === room.activeIdentity.value?.participantId) {
    return room.avatarImageDataUrl.value
  }
  return null
}

function updateScrollState() {
  const element = messagesContainer.value
  if (!element) return
  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight
  isNearBottom.value = distanceToBottom < 80
  if (isNearBottom.value) unreadCount.value = 0
}

async function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  await nextTick()
  messagesContainer.value?.scrollTo({ top: messagesContainer.value.scrollHeight, behavior })
  updateScrollState()
}

function handleMessageKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    room.sendTextMessage()
  }
}

async function handleDiscoveriesScroll() {
  const element = discoveriesContainer.value
  if (!element || room.composerPanel.value !== 'discoveries') {
    return
  }

  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight
  if (distanceToBottom > 96) {
    return
  }

  await room.loadMoreDiscoveries()
}

function toggleParticipants() {
  isParticipantsOpen.value = !isParticipantsOpen.value
  if (isParticipantsOpen.value) {
    isSettingsOpen.value = false
  }
}

function toggleSettings() {
  isSettingsOpen.value = !isSettingsOpen.value
  if (isSettingsOpen.value) {
    isParticipantsOpen.value = false
  }
}

function openAvatarPicker() {
  avatarInput.value?.click()
}

async function handleAvatarFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  await room.setAvatarImage(target.files?.[0] ?? null)
  target.value = ''
}

async function copyMediaLink(url: string) {
  await copyMediaToClipboard(url)
  copiedMediaUrl.value = url
  window.setTimeout(() => {
    if (copiedMediaUrl.value === url) {
      copiedMediaUrl.value = ''
    }
  }, 1800)
}

async function handleMediaMessageClick(message: ChatMessage) {
  const url = message.attachment?.pageUrl || message.attachment?.mediaUrl
  if (!url) {
    return
  }

  await copyMediaLink(url)
}

useEventListener(messagesContainer, 'scroll', updateScrollState, { passive: true })
useEventListener(discoveriesContainer, 'scroll', handleDiscoveriesScroll, { passive: true })

watch(
  () => messages.value.length,
  async (nextLength, previousLength = 0) => {
    const lastMessage = messages.value[messages.value.length - 1] ?? null
    if (
      !previousLength ||
      isNearBottom.value ||
      lastMessage?.participantId === room.activeIdentity.value?.participantId
    ) {
      await scrollToBottom(previousLength ? 'smooth' : 'auto')
      return
    }
    if (nextLength > previousLength) unreadCount.value += nextLength - previousLength
  },
  { immediate: true },
)

watch(
  () => room.activeRoom.value?.roomId,
  async () => {
    isSettingsOpen.value = false
    isParticipantsOpen.value = false
    unreadCount.value = 0
    isNearBottom.value = true
    await scrollToBottom()
  },
)
</script>

<template>
  <div class="h-dvh overflow-hidden bg-bg-deep text-text-primary font-body">
    <div class="mx-auto flex h-full max-w-6xl flex-col sm:px-4 sm:py-4">
      <main
        class="flex min-h-0 flex-1 flex-col border-y border-border-default bg-bg-surface sm:border"
      >
        <header class="flex items-center gap-3 border-b border-border-default px-3 py-3 sm:px-5">
          <RouterLink
            to="/"
            class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-elevated text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
            ><Icon icon="lucide:arrow-left" class="size-4"
          /></RouterLink>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] uppercase tracking-[0.28em] text-accent-coral">chat online</p>
            <h1 class="truncate font-display text-lg font-semibold sm:text-2xl">{{ roomTitle }}</h1>
            <p class="truncate text-xs text-text-secondary sm:text-sm">
              {{
                room.activeRoom.value
                  ? `${participantLabel} · ${room.connectionLabel.value}`
                  : 'Nhập tên rồi tạo phòng hoặc vào phòng để chat realtime.'
              }}
            </p>
          </div>
          <button
            v-if="room.activeRoom.value"
            class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-elevated text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
            @click="toggleParticipants"
          >
            <Icon icon="lucide:users" class="size-4" />
          </button>
          <button
            class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-elevated text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
            @click="toggleSettings"
          >
            <Icon icon="lucide:settings-2" class="size-4" />
          </button>
        </header>

        <section
          v-if="!room.activeRoom.value"
          class="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
        >
          <div
            class="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
          >
            <div
              class="space-y-4 border border-border-default bg-[linear-gradient(180deg,rgba(255,250,244,0.3)_0%,rgba(251,231,211,0.5)_100%)] p-4 sm:p-5"
            >
              <div>
                <p class="text-[11px] uppercase tracking-[0.28em] text-accent-coral">
                  {{ room.currentRoomId.value ? 'vào phòng' : 'tạo phòng' }}
                </p>
                <h2 class="mt-2 font-display text-2xl font-semibold sm:text-4xl">
                  {{
                    room.currentRoomId.value
                      ? 'Điền thông tin để vào phòng'
                      : 'Room chat cho bạn bè'
                  }}
                </h2>
              </div>
              <div
                v-if="room.errorMessage.value"
                class="border border-accent-coral bg-[rgba(231,111,81,0.08)] px-4 py-3 text-sm text-accent-coral"
              >
                {{ room.errorMessage.value }}
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <input
                  :value="room.displayNameDraft.value"
                  type="text"
                  maxlength="24"
                  placeholder="Tên người dùng"
                  class="border border-border-default bg-bg-surface px-3 py-3 text-sm outline-none transition focus:border-accent-coral"
                  @input="room.setProfileDraftName(($event.target as HTMLInputElement).value)"
                />
                <input
                  v-model="room.roomNameDraft.value"
                  type="text"
                  maxlength="48"
                  placeholder="Tên phòng mới"
                  class="border border-border-default bg-bg-surface px-3 py-3 text-sm outline-none transition focus:border-accent-coral"
                />
              </div>
              <div class="flex gap-3">
                <input
                  v-model="room.inviteCodeDraft.value"
                  type="text"
                  maxlength="32"
                  placeholder="Mã phòng để vào"
                  class="min-w-0 flex-1 border border-border-default bg-bg-surface px-3 py-3 text-sm outline-none transition focus:border-accent-sky"
                />
                <button
                  class="inline-flex size-12 shrink-0 items-center justify-center border border-border-default bg-bg-elevated text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
                  @click="openAvatarPicker"
                >
                  <Icon icon="lucide:image-plus" class="size-4" />
                </button>
              </div>
              <input
                ref="avatarInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleAvatarFileChange"
              />
              <div class="space-y-3 border border-border-default bg-bg-elevated p-4">
                <div class="flex items-center gap-3">
                  <div
                    class="flex size-14 items-center justify-center overflow-hidden border border-border-default bg-bg-surface text-2xl"
                  >
                    <img
                      v-if="room.avatarImageDataUrl.value"
                      :src="room.avatarImageDataUrl.value"
                      alt="Avatar xem trước"
                      class="h-full w-full object-cover"
                    />
                    <span v-else>{{ getPresetEmoji(room.activeAvatarPreset.value) }}</span>
                  </div>
                  <div class="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-8">
                    <button
                      v-for="preset in room.avatarPresets"
                      :key="preset.id"
                      class="flex aspect-square items-center justify-center border text-xl transition"
                      :class="
                        room.activeAvatarPreset.value === preset.id
                          ? 'border-accent-coral bg-[rgba(231,111,81,0.08)]'
                          : 'border-border-default bg-bg-surface hover:border-accent-coral'
                      "
                      @click="room.setAvatarPreset(preset.id)"
                    >
                      {{ preset.emoji }}
                    </button>
                  </div>
                </div>
                <button
                  v-if="room.avatarImageDataUrl.value"
                  class="inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
                  @click="room.clearAvatarImage"
                >
                  <Icon icon="lucide:x" class="size-3.5" />Bỏ ảnh local
                </button>
              </div>
              <div class="flex flex-col gap-3 sm:flex-row">
                <button
                  class="inline-flex min-h-12 flex-1 items-center justify-center gap-2 border border-accent-coral bg-accent-coral px-5 py-3 text-sm font-semibold text-bg-surface transition hover:bg-accent-coral/90 disabled:opacity-60"
                  :disabled="room.isBusy.value"
                  @click="room.createRoom"
                >
                  <Icon icon="lucide:plus" class="size-4" />Tạo phòng
                </button>
                <button
                  class="inline-flex min-h-12 flex-1 items-center justify-center gap-2 border border-border-default bg-bg-elevated px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-accent-sky hover:text-accent-sky disabled:opacity-60"
                  :disabled="room.isBusy.value"
                  @click="room.joinRoomFromInvite"
                >
                  <Icon icon="lucide:door-open" class="size-4" />Vào phòng
                </button>
              </div>
              <p v-if="room.environmentHint.value" class="text-sm text-accent-amber">
                {{ room.environmentHint.value }}
              </p>
            </div>

            <div class="space-y-4 border border-border-default bg-bg-elevated p-4 sm:p-5">
              <div
                v-if="room.roomPreview.value"
                class="border border-border-default bg-bg-surface p-4"
              >
                <div class="text-[11px] uppercase tracking-[0.22em] text-text-dim">
                  Preview room
                </div>
                <div class="mt-2 font-display text-2xl font-semibold">
                  {{ room.roomPreview.value.roomName }}
                </div>
                <div class="mt-1 text-sm text-text-secondary">
                  {{ room.roomPreview.value.participants.length }} người đang có trong phòng này.
                </div>
              </div>
              <div class="border border-border-default bg-bg-surface p-4">
                <div class="text-[11px] uppercase tracking-[0.22em] text-text-dim">Test nhanh</div>
                <ul class="mt-3 space-y-3 text-sm leading-6 text-text-secondary">
                  <li>
                    Không lưu database, không ghi nhớ phòng sau khi bạn rời đi hoặc server restart.
                  </li>
                  <li>
                    Tạo phòng ở một tab, copy link mời rồi mở tab hoặc thiết bị khác để vào test
                    realtime.
                  </li>
                  <li>Avatar ảnh chỉ dùng tạm ở máy hiện tại, không upload lên server.</li>
                </ul>
              </div>
              <div
                class="border border-dashed border-border-default bg-[rgba(251,231,211,0.24)] px-4 py-5 text-sm text-text-secondary"
              >
                Mục tiêu của app này là chat realtime nhẹ để bạn test cùng bạn bè, không có lịch sử
                lưu trữ.
              </div>
            </div>
          </div>
        </section>

        <template v-else>
          <div
            class="relative flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,250,244,0.35)_0%,rgba(251,231,211,0.48)_100%)]"
          >
            <div
              ref="messagesContainer"
              class="chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5"
            >
              <article
                v-for="message in messages"
                :key="message.messageId"
                class="flex items-end gap-2"
                :class="isMine(message) ? 'justify-end' : 'justify-start'"
              >
                <div
                  v-if="!isMine(message)"
                  class="flex size-9 shrink-0 items-center justify-center overflow-hidden border border-border-default bg-bg-surface text-base sm:size-10 sm:text-lg"
                >
                  <img
                    v-if="getAvatarImage(getParticipant(message.participantId))"
                    :src="getAvatarImage(getParticipant(message.participantId)) ?? ''"
                    :alt="message.displayName"
                    class="h-full w-full object-cover"
                  />
                  <span v-else-if="getAvatarEmoji(getParticipant(message.participantId))">{{
                    getAvatarEmoji(getParticipant(message.participantId))
                  }}</span>
                  <span v-else>{{ getInitials(message.displayName) }}</span>
                </div>
                <div class="max-w-[82%] sm:max-w-[68%]">
                  <div
                    class="mb-1 flex items-center gap-2 px-1 text-[11px] uppercase tracking-[0.18em] text-text-dim"
                    :class="isMine(message) ? 'justify-end' : 'justify-start'"
                  >
                    <span>{{ message.displayName }}</span
                    ><span>{{ formatTime(message.createdAt) }}</span>
                  </div>
                  <div
                    class="border px-3 py-2.5 sm:px-4"
                    :class="
                      isMine(message)
                        ? 'border-accent-coral bg-[rgba(231,111,81,0.1)]'
                        : 'border-border-default bg-bg-surface'
                    "
                  >
                    <div
                      v-if="message.kind === 'text'"
                      class="whitespace-pre-wrap break-words text-sm leading-7 text-text-primary"
                    >
                      <template
                        v-for="(segment, index) in parseTextSegments(message.text)"
                        :key="`${message.messageId}-${index}`"
                        ><span v-if="segment.type === 'text'">{{ segment.value }}</span
                        ><img
                          v-else-if="segment.emoticon"
                          :src="segment.emoticon.imageUrl"
                          :alt="segment.emoticon.title"
                          class="mx-0.5 inline-block h-5 w-5 align-[-0.3rem] sm:h-6 sm:w-6"
                          loading="lazy"
                      /></template>
                    </div>
                    <button
                      v-else-if="message.kind === 'icon' && message.attachment"
                      class="inline-flex"
                      type="button"
                      :title="
                        copiedMediaUrl ===
                        (message.attachment.pageUrl || message.attachment.mediaUrl)
                          ? 'Đã copy link'
                          : 'Click để copy link'
                      "
                      @click="handleMediaMessageClick(message)"
                    >
                      <img
                        :src="message.attachment.mediaUrl"
                        :alt="message.attachment.title"
                        class="h-10 w-10 object-contain sm:h-12 sm:w-12"
                        loading="lazy"
                      />
                    </button>
                    <button
                      v-else-if="message.attachment?.mediaKind === 'video'"
                      class="inline-flex max-w-full"
                      type="button"
                      :title="
                        copiedMediaUrl ===
                        (message.attachment.pageUrl || message.attachment.mediaUrl)
                          ? 'Đã copy link'
                          : 'Click để copy link'
                      "
                      @click="handleMediaMessageClick(message)"
                    >
                      <video
                        :src="message.attachment.mediaUrl"
                        class="max-h-72 w-auto max-w-full border border-border-default object-contain"
                        autoplay
                        loop
                        muted
                        playsinline
                      />
                    </button>
                    <button
                      v-else-if="message.attachment"
                      class="inline-flex max-w-full"
                      type="button"
                      :title="
                        copiedMediaUrl ===
                        (message.attachment.pageUrl || message.attachment.mediaUrl)
                          ? 'Đã copy link'
                          : 'Click để copy link'
                      "
                      @click="handleMediaMessageClick(message)"
                    >
                      <img
                        :src="message.attachment.mediaUrl"
                        :alt="message.attachment.title"
                        class="max-h-72 w-auto max-w-full border border-border-default object-contain"
                        loading="lazy"
                      />
                    </button>
                  </div>
                </div>
              </article>
              <div
                v-if="room.typingParticipants.value.length"
                class="inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-secondary"
              >
                <Icon icon="lucide:ellipsis" class="size-4 text-accent-sky" />{{
                  room.typingParticipants.value
                    .map((participant) => participant.displayName)
                    .join(', ')
                }}
                đang gõ...
              </div>
            </div>

            <div
              v-if="!isNearBottom"
              class="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-3 sm:bottom-32"
            >
              <button
                class="pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 border border-accent-coral bg-bg-surface px-4 py-2 text-sm font-semibold text-accent-coral shadow-[0_14px_32px_rgba(47,36,31,0.12)] transition hover:bg-bg-elevated"
                @click="scrollToBottom('smooth')"
              >
                <Icon icon="lucide:arrow-down" class="size-4" />{{
                  unreadCount ? `Có ${unreadCount} tin mới` : 'Về cuối chat'
                }}
              </button>
            </div>

            <div class="border-t border-border-default bg-bg-surface p-3 sm:p-4">
              <div
                v-if="room.errorMessage.value"
                class="mb-3 border border-accent-coral bg-[rgba(231,111,81,0.08)] px-4 py-3 text-sm text-accent-coral"
              >
                {{ room.errorMessage.value }}
              </div>
              <div
                v-if="room.composerPanel.value !== 'none'"
                class="mb-3 border border-border-default bg-bg-elevated p-3"
              >
                <div v-if="room.composerPanel.value === 'yahoo'">
                  <input
                    v-model="room.yahooSearch.value"
                    type="text"
                    placeholder="Tìm icon Yahoo"
                    class="w-full border border-border-default bg-bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent-coral"
                  />
                  <div
                    class="chat-scroll mt-3 grid max-h-44 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8"
                  >
                    <button
                      v-for="item in room.filteredYahooEmoticons.value"
                      :key="item.id"
                      class="flex aspect-square items-center justify-center border border-border-default bg-bg-surface p-2 transition hover:border-accent-coral"
                      @click="room.sendYahooIconMessage(item)"
                    >
                      <img
                        :src="item.imageUrl"
                        :alt="item.title"
                        class="h-8 w-8 object-contain"
                        loading="lazy"
                      />
                    </button>
                  </div>
                </div>
                <div v-else>
                  <div class="mb-3 flex gap-2">
                    <button
                      v-for="kind in DISCOVERY_KINDS"
                      :key="kind"
                      class="border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition"
                      :class="
                        room.discoveryKind.value === kind
                          ? 'border-accent-amber bg-[rgba(216,155,29,0.1)] text-accent-amber'
                          : 'border-border-default bg-bg-surface text-text-dim hover:text-text-primary'
                      "
                      @click="room.loadDiscoveries(kind)"
                    >
                      {{ kind }}
                    </button>
                  </div>
                  <div
                    ref="discoveriesContainer"
                    class="chat-scroll grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4"
                  >
                    <button
                      v-for="item in room.discoveries.value"
                      :key="`${item.mediaKind}-${item.id}`"
                      class="border border-border-default bg-bg-surface p-2 transition hover:border-accent-amber"
                      @click="room.sendMemeMessage(item)"
                    >
                      <img
                        v-if="item.mediaKind !== 'video'"
                        :src="item.imageUrl"
                        :alt="item.title"
                        class="h-20 w-full border border-border-default object-cover"
                        loading="lazy"
                      />
                      <video
                        v-else
                        :src="item.imageUrl"
                        class="h-20 w-full border border-border-default object-cover"
                        autoplay
                        loop
                        muted
                        playsinline
                      />
                    </button>
                  </div>
                  <div
                    v-if="room.isLoadingMoreDiscoveries.value"
                    class="mt-3 text-center text-xs uppercase tracking-[0.18em] text-text-dim"
                  >
                    Đang tải thêm media...
                  </div>
                </div>
              </div>
              <div class="flex items-end gap-2">
                <button
                  class="inline-flex size-11 items-center justify-center border transition"
                  :class="
                    room.composerPanel.value === 'yahoo'
                      ? 'border-accent-coral bg-[rgba(231,111,81,0.1)] text-accent-coral'
                      : 'border-border-default bg-bg-elevated text-text-secondary hover:text-text-primary'
                  "
                  @click="room.openComposerPanel('yahoo')"
                >
                  <Icon icon="lucide:smile-plus" class="size-4" />
                </button>
                <button
                  class="inline-flex size-11 items-center justify-center border transition"
                  :class="
                    room.composerPanel.value === 'discoveries'
                      ? 'border-accent-amber bg-[rgba(216,155,29,0.1)] text-accent-amber'
                      : 'border-border-default bg-bg-elevated text-text-secondary hover:text-text-primary'
                  "
                  @click="room.openComposerPanel('discoveries')"
                >
                  <Icon icon="lucide:gallery-horizontal" class="size-4" />
                </button>
                <textarea
                  v-model="room.messageDraft.value"
                  rows="1"
                  placeholder="Nhắn tin..."
                  class="min-h-12 flex-1 resize-none border border-border-default bg-bg-elevated px-4 py-3 text-sm leading-6 outline-none transition focus:border-accent-coral disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="!room.socketConnected.value"
                  @input="room.markTyping"
                  @keydown="handleMessageKeydown"
                />
                <button
                  class="inline-flex size-12 shrink-0 items-center justify-center border border-accent-coral bg-accent-coral text-bg-surface transition hover:bg-accent-coral/90 disabled:opacity-60"
                  :disabled="!room.socketConnected.value || !room.messageDraft.value.trim()"
                  @click="room.sendTextMessage"
                >
                  <Icon icon="lucide:send" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <aside
          v-if="isSettingsOpen"
          class="absolute inset-x-0 bottom-0 z-20 max-h-[80vh] border-t border-border-default bg-bg-surface shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[22rem] md:border-t-0 md:border-l"
        >
          <div class="flex items-center justify-between border-b border-border-default px-4 py-3">
            <div>
              <div class="text-xs uppercase tracking-[0.22em] text-text-dim">Settings</div>
              <div class="mt-1 font-display text-xl font-semibold">Chat Info</div>
            </div>
            <button
              class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-elevated text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
              @click="isSettingsOpen = false"
            >
              <Icon icon="lucide:x" class="size-4" />
            </button>
          </div>
          <div class="chat-scroll space-y-5 overflow-y-auto p-4">
            <section class="border border-border-default bg-bg-elevated p-4">
              <div class="text-xs uppercase tracking-[0.2em] text-text-dim">Connection</div>
              <div class="mt-2 text-sm font-semibold text-text-primary">
                {{ room.connectionLabel.value }}
              </div>
              <div class="mt-1 text-sm text-text-secondary">
                TTL: {{ room.expiresInLabel.value }}
              </div>
            </section>
            <section
              v-if="room.activeRoom.value"
              class="border border-border-default bg-bg-elevated p-4"
            >
              <div class="text-xs uppercase tracking-[0.2em] text-text-dim">Room</div>
              <div class="mt-2 font-display text-2xl font-semibold">
                {{ room.activeRoom.value.roomName }}
              </div>
              <div class="mt-1 font-mono text-sm text-text-secondary">
                {{ room.activeRoom.value.roomId }}
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  class="inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
                  @click="room.copyInviteLink"
                >
                  <Icon
                    :icon="room.copied.value ? 'lucide:check' : 'lucide:copy'"
                    class="size-3.5"
                  />{{ room.copied.value ? 'Đã copy link' : 'Copy link mời' }}</button
                ><button
                  class="inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
                  @click="room.leaveRoom"
                >
                  <Icon icon="lucide:log-out" class="size-3.5" />Rời phòng
                </button>
              </div>
            </section>
          </div>
        </aside>

        <aside
          v-if="isParticipantsOpen && room.activeRoom.value"
          class="absolute inset-x-0 bottom-0 z-20 max-h-[80vh] border-t border-border-default bg-bg-surface shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[22rem] md:border-t-0 md:border-l"
        >
          <div class="flex items-center justify-between border-b border-border-default px-4 py-3">
            <div>
              <div class="text-xs uppercase tracking-[0.22em] text-text-dim">Participants</div>
              <div class="mt-1 font-display text-xl font-semibold">{{ participantLabel }}</div>
            </div>
            <button
              class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-elevated text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
              @click="isParticipantsOpen = false"
            >
              <Icon icon="lucide:x" class="size-4" />
            </button>
          </div>
          <div class="chat-scroll space-y-3 overflow-y-auto p-4">
            <div class="grid grid-cols-3 gap-2">
              <div class="border border-border-default bg-bg-elevated px-3 py-3 text-center">
                <div class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Total</div>
                <div class="mt-2 font-display text-2xl font-semibold text-text-primary">
                  {{ room.activeRoom.value.participants.length }}
                </div>
              </div>
              <div class="border border-border-default bg-bg-elevated px-3 py-3 text-center">
                <div class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Online</div>
                <div class="mt-2 font-display text-2xl font-semibold text-accent-sky">
                  {{ room.onlineParticipants.value.length }}
                </div>
              </div>
              <div class="border border-border-default bg-bg-elevated px-3 py-3 text-center">
                <div class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Away</div>
                <div class="mt-2 font-display text-2xl font-semibold text-accent-amber">
                  {{
                    Math.max(
                      room.activeRoom.value.participants.length -
                        room.onlineParticipants.value.length,
                      0,
                    )
                  }}
                </div>
              </div>
            </div>
            <div
              v-for="participant in room.activeRoom.value.participants"
              :key="participant.participantId"
              class="border border-border-default bg-bg-elevated p-3"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex size-11 items-center justify-center overflow-hidden border border-border-default bg-bg-surface text-lg"
                >
                  <img
                    v-if="getAvatarImage(participant)"
                    :src="getAvatarImage(participant) ?? ''"
                    :alt="participant.displayName"
                    class="h-full w-full object-cover"
                  /><span v-else-if="getAvatarEmoji(participant)">{{
                    getAvatarEmoji(participant)
                  }}</span
                  ><span v-else>{{ getInitials(participant.displayName) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate font-semibold text-text-primary">
                    {{ participant.displayName }}
                  </div>
                  <div class="mt-1 text-xs text-text-dim">
                    {{ participant.connected ? 'Đang online' : 'Tạm vắng' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
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
  width: 8px;
  height: 8px;
}

.chat-scroll::-webkit-scrollbar-track {
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.96), rgba(251, 231, 211, 0.82));
}

.chat-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(231, 111, 81, 0.95), rgba(216, 155, 29, 0.92));
  border: 1px solid rgba(255, 250, 244, 0.96);
  border-radius: 999px;
}
</style>
