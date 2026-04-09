<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useIntervalFn, useTextareaAutosize } from '@vueuse/core'
import { RouterLink } from 'vue-router'
import { createAiChatCompletion, fetchFreeModels } from './api/client'
import type { AiChatBubble, AiChatRequestMessage, FreeAiModel } from './api/types'

const chatViewport = ref<HTMLElement | null>(null)
const isLoadingModels = ref(true)
const isSending = ref(false)
const isAnimatingResponse = ref(false)
const isConfigOpen = ref(false)
const loadError = ref('')
const sendError = ref('')
const freeModels = ref<FreeAiModel[]>([])
const selectedModel = ref('openrouter/free')
const activeRequestController = ref<AbortController | null>(null)

const bubbles = ref<AiChatBubble[]>([
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'Chào bạn. Đây là khung chat AI tối giản của HACHITU. Chọn model miễn phí rồi gửi câu hỏi để bắt đầu.',
    modelLabel: 'openrouter/free',
  },
])

const typingBubbleId = ref('')
const typingSourceText = ref('')
const typingCursor = ref(0)

const { textarea, input: prompt } = useTextareaAutosize()

const FAST_MODEL_HINTS = ['1.2b', '2b', '3b', '4b', 'mini', 'nano', 'air'] as const

const modelOptions = computed(() => [
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    description: 'Tự chọn free model phù hợp ở thời điểm hiện tại',
    contextLength: null,
  },
  ...freeModels.value.filter((model) => model.id !== 'openrouter/free'),
])

const selectedModelMeta = computed(() =>
  modelOptions.value.find((model) => model.id === selectedModel.value) ?? modelOptions.value[0],
)

const prioritizedFreeModels = computed(() =>
  [...freeModels.value]
    .filter((model) => model.id !== 'openrouter/free')
    .filter((model) => model.outputModalities.includes('text'))
    .sort((left, right) => scoreModel(right) - scoreModel(left)),
)

const fallbackModelIds = computed(() => {
  const freeTextModelIds = prioritizedFreeModels.value.map((model) => model.id)

  if (selectedModel.value === 'openrouter/free') {
    return freeTextModelIds.slice(0, 3)
  }

  return [
    selectedModel.value,
    ...freeTextModelIds.filter((modelId) => modelId !== selectedModel.value).slice(0, 2),
  ]
})

const activeModelCount = computed(() => Math.max(modelOptions.value.length - 1, 0))
const canSend = computed(
  () =>
    prompt.value.trim().length > 0 &&
    !isSending.value &&
    !isAnimatingResponse.value &&
    !isLoadingModels.value,
)

function scoreModel(model: FreeAiModel): number {
  const normalizedId = model.id.toLowerCase()
  let score = 0

  for (const hint of FAST_MODEL_HINTS) {
    if (normalizedId.includes(hint)) {
      score += 10
    }
  }

  if (normalizedId.includes('thinking') || normalizedId.includes('reasoning')) {
    score -= 8
  }

  if (
    normalizedId.includes('70b') ||
    normalizedId.includes('120b') ||
    normalizedId.includes('405b')
  ) {
    score -= 6
  }

  return score
}

function formatContextLength(value: number | null | undefined): string {
  if (!value) {
    return 'Không rõ'
  }

  return value.toLocaleString('en-US')
}

function buildRequestMessages(): AiChatRequestMessage[] {
  return bubbles.value
    .filter((bubble) => bubble.role === 'assistant' || bubble.role === 'user')
    .slice(-8)
    .map((bubble) => ({
      role: bubble.role,
      content: bubble.content,
    }))
}

async function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
  await nextTick()
  const viewport = chatViewport.value
  if (!viewport) {
    return
  }

  viewport.scrollTo({
    top: viewport.scrollHeight,
    behavior,
  })
}

function updateBubbleContent(id: string, content: string) {
  bubbles.value = bubbles.value.map((bubble) =>
    bubble.id === id ? { ...bubble, content } : bubble,
  )
}

async function finalizeTypingAnimation() {
  const bubbleId = typingBubbleId.value
  if (!bubbleId) {
    return
  }

  updateBubbleContent(bubbleId, typingSourceText.value)
  pauseTyping()
  isAnimatingResponse.value = false
  typingBubbleId.value = ''
  typingSourceText.value = ''
  typingCursor.value = 0
  await scrollToBottom()
}

const { pause: pauseTyping, resume: resumeTyping } = useIntervalFn(
  () => {
    if (!typingBubbleId.value) {
      pauseTyping()
      return
    }

    const totalLength = typingSourceText.value.length
    const nextCursor = Math.min(
      typingCursor.value + Math.max(2, Math.ceil(totalLength / 90)),
      totalLength,
    )

    typingCursor.value = nextCursor
    updateBubbleContent(typingBubbleId.value, typingSourceText.value.slice(0, nextCursor))
    void scrollToBottom('auto')

    if (nextCursor >= totalLength) {
      void finalizeTypingAnimation()
    }
  },
  18,
  { immediate: false },
)

async function startTypingAnimation(modelLabel: string, fullText: string) {
  const bubbleId = crypto.randomUUID()
  bubbles.value.push({
    id: bubbleId,
    role: 'assistant',
    content: '',
    modelLabel,
  })

  typingBubbleId.value = bubbleId
  typingSourceText.value = fullText
  typingCursor.value = 0
  isAnimatingResponse.value = true

  await nextTick()
  resumeTyping()
}

function stopResponse() {
  activeRequestController.value?.abort()
  activeRequestController.value = null

  if (isAnimatingResponse.value) {
    void finalizeTypingAnimation()
  }

  isSending.value = false
}

async function loadModels() {
  isLoadingModels.value = true
  loadError.value = ''

  try {
    const response = await fetchFreeModels()
    freeModels.value = response.models
  }
  catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Không tải được danh sách model miễn phí'
  }
  finally {
    isLoadingModels.value = false
  }
}

async function sendMessage() {
  const content = prompt.value.trim()
  if (!content || isSending.value || isAnimatingResponse.value) {
    return
  }

  const controller = new AbortController()
  activeRequestController.value = controller

  sendError.value = ''
  bubbles.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    content,
  })
  prompt.value = ''
  await scrollToBottom()

  isSending.value = true

  try {
    const response = await createAiChatCompletion({
      model: selectedModel.value,
      models: fallbackModelIds.value,
      messages: buildRequestMessages(),
      systemPrompt:
        'Trả lời ngắn gọn, trực tiếp, bằng tiếng Việt có dấu. Ưu tiên câu ngắn và rõ ràng.',
      maxTokens: 320,
      signal: controller.signal,
    })

    const answer = response.choices?.[0]?.message?.content?.trim()
    if (!answer) {
      throw new Error('Model không trả về nội dung hợp lệ')
    }

    const modelLabel = response.model || selectedModel.value
    await startTypingAnimation(modelLabel, answer)
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      sendError.value = 'Đã dừng yêu cầu hiện tại.'
    }
    else {
      sendError.value =
        error instanceof Error ? error.message : 'Không gửi được tin nhắn tới AI'
    }
  }
  finally {
    if (activeRequestController.value === controller) {
      activeRequestController.value = null
    }
    isSending.value = false
  }
}

function clearChat() {
  activeRequestController.value?.abort()
  activeRequestController.value = null
  pauseTyping()
  isAnimatingResponse.value = false
  typingBubbleId.value = ''
  typingSourceText.value = ''
  typingCursor.value = 0
  bubbles.value = [
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        'Phiên chat đã được làm mới. Chọn một model miễn phí rồi gửi câu hỏi tiếp theo.',
      modelLabel: selectedModel.value,
    },
  ]
  sendError.value = ''
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendMessage()
  }
}

onMounted(() => {
  void loadModels()
})
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <div class="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section class="order-1 animate-fade-up">
          <div class="border border-border-default bg-bg-surface">
            <div
              class="flex items-center justify-between gap-3 border-b border-border-default px-4 py-4 sm:px-5"
            >
              <div class="min-w-0">
                <p class="text-[11px] uppercase tracking-[0.18em] text-accent-coral">AI Chat</p>
                <p class="mt-1 font-display text-2xl text-text-primary sm:text-3xl">
                  Chat nhanh với free models
                </p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center justify-center border border-border-default bg-bg-deep p-2 text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
                  @click="isConfigOpen = true"
                >
                  <Icon icon="lucide:settings-2" class="size-5" />
                </button>
                <RouterLink
                  to="/"
                  class="inline-flex items-center justify-center border border-border-default bg-bg-deep p-2 text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
                >
                  <Icon icon="lucide:arrow-left" class="size-5" />
                </RouterLink>
              </div>
            </div>

            <div
              ref="chatViewport"
              class="h-[58vh] min-h-[52vh] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(231,111,81,0.08),transparent_34%),linear-gradient(180deg,rgba(255,250,244,0.94),rgba(246,239,230,0.88))] px-4 py-4 sm:h-[60vh] sm:min-h-[460px] sm:px-5"
            >
              <div class="mx-auto flex max-w-3xl flex-col gap-3">
                <article
                  v-for="bubble in bubbles"
                  :key="bubble.id"
                  class="max-w-[92%] border px-4 py-3 shadow-[0_10px_24px_rgba(47,36,31,0.06)] sm:max-w-[82%]"
                  :class="
                    bubble.role === 'user'
                      ? 'self-end border-accent-coral bg-[linear-gradient(180deg,rgba(231,111,81,0.16),rgba(231,111,81,0.08))]'
                      : 'border-border-default bg-bg-surface'
                  "
                >
                  <div class="flex items-center justify-between gap-3">
                    <p
                      class="text-[11px] uppercase tracking-[0.18em]"
                      :class="bubble.role === 'user' ? 'text-accent-coral' : 'text-accent-sky'"
                    >
                      {{ bubble.role === 'user' ? 'Bạn' : 'AI' }}
                    </p>
                    <span v-if="bubble.modelLabel" class="text-[11px] text-text-dim">
                      {{ bubble.modelLabel }}
                    </span>
                  </div>

                  <p class="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-text-primary">
                    {{ bubble.content }}
                    <span
                      v-if="isAnimatingResponse && bubble.id === typingBubbleId"
                      class="ml-1 inline-block h-4 w-[2px] animate-pulse bg-accent-coral align-middle"
                    />
                  </p>
                </article>

                <div
                  v-if="isSending"
                  class="max-w-[82%] self-start border border-border-default bg-bg-surface px-4 py-3 shadow-[0_10px_24px_rgba(47,36,31,0.06)]"
                >
                  <p class="text-[11px] uppercase tracking-[0.18em] text-accent-sky">AI</p>
                  <div class="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                    <span class="size-2 animate-pulse bg-accent-coral" />
                    <span>Đang chờ phản hồi từ model...</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="border-t border-border-default px-4 py-4 sm:px-5">
              <p v-if="sendError" class="mb-3 text-sm leading-6 text-accent-coral">
                {{ sendError }}
              </p>

              <div class="mx-auto max-w-3xl">
                <textarea
                  id="ai-chat-prompt"
                  ref="textarea"
                  v-model="prompt"
                  rows="1"
                  class="min-h-[120px] w-full resize-none border border-border-default bg-bg-deep px-4 py-4 text-sm leading-7 text-text-primary outline-none transition focus:border-accent-coral"
                  placeholder="Nhập nội dung cần hỏi AI... Enter để gửi, Shift + Enter để xuống dòng"
                  @keydown="handleComposerKeydown"
                />

                <div class="mt-3 flex flex-col gap-3">
                  <div class="border border-border-default bg-bg-deep px-4 py-3">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-[11px] uppercase tracking-[0.18em] text-text-dim">
                          Model đang chọn
                        </p>
                        <p class="mt-1 font-display text-lg text-text-primary">
                          {{ selectedModelMeta?.name ?? 'OpenRouter Free Router' }}
                        </p>
                      </div>
                      <div
                        class="border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-dim"
                      >
                        {{ activeModelCount }} free models
                      </div>
                    </div>

                    <select
                      id="ai-model"
                      v-model="selectedModel"
                      class="mt-3 w-full border border-border-default bg-bg-surface px-3 py-3 text-sm text-text-primary outline-none transition focus:border-accent-coral"
                      :disabled="isLoadingModels || isSending || isAnimatingResponse"
                    >
                      <option v-for="model in modelOptions" :key="model.id" :value="model.id">
                        {{ model.name }}
                      </option>
                    </select>
                  </div>

                  <div class="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center gap-2 border border-border-default bg-bg-deep px-4 py-3 text-sm text-text-secondary transition hover:border-accent-amber hover:text-text-primary"
                      @click="clearChat"
                    >
                      <Icon icon="lucide:refresh-cw" class="size-4" />
                      <span>Làm mới chat</span>
                    </button>

                    <div class="flex flex-col gap-3 sm:flex-row">
                      <button
                        v-if="isSending || isAnimatingResponse"
                        type="button"
                        class="inline-flex items-center justify-center gap-2 border border-border-default bg-bg-deep px-5 py-3 font-display text-sm font-semibold text-text-secondary transition hover:border-accent-amber hover:text-text-primary"
                        @click="stopResponse"
                      >
                        <Icon icon="lucide:square" class="size-4" />
                        <span>Dừng trả lời</span>
                      </button>

                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 border border-accent-coral bg-accent-coral px-5 py-3 font-display text-sm font-semibold text-bg-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="!canSend"
                        @click="sendMessage"
                      >
                        <Icon icon="lucide:send" class="size-4" />
                        <span>
                          {{
                            isSending
                              ? 'Đang gửi...'
                              : isAnimatingResponse
                                ? 'AI đang gõ...'
                                : 'Gửi tin nhắn'
                          }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="order-2 hidden xl:block animate-fade-up animate-delay-2">
          <div
            class="border border-border-default bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(247,239,231,0.98))] px-5 py-5"
          >
            <p class="text-[11px] uppercase tracking-[0.22em] text-accent-coral">Phiên hiện tại</p>
            <div class="mt-5 grid gap-3">
              <div class="border border-border-default bg-bg-surface px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Chế độ</p>
                <p class="mt-2 font-display text-lg text-text-primary">Nhanh và gọn</p>
              </div>
              <div class="border border-border-default bg-bg-surface px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Model free</p>
                <p class="mt-2 font-display text-lg text-text-primary">{{ activeModelCount }}</p>
              </div>
              <div class="border border-border-default bg-bg-surface px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Lịch sử</p>
                <p class="mt-2 font-display text-lg text-text-primary">Chỉ trong phiên</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div
      v-if="isConfigOpen"
      class="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(47,36,31,0.35)] px-4 py-4 sm:items-center"
      @click.self="isConfigOpen = false"
    >
      <div class="w-full max-w-lg border border-border-default bg-bg-surface shadow-[0_20px_60px_rgba(47,36,31,0.18)]">
        <div class="flex items-center justify-between gap-3 border-b border-border-default px-5 py-4">
          <div>
            <p class="text-[11px] uppercase tracking-[0.18em] text-accent-coral">Settings</p>
            <p class="mt-1 font-display text-2xl text-text-primary">Thông tin app</p>
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center border border-border-default bg-bg-deep p-2 text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
            @click="isConfigOpen = false"
          >
            <Icon icon="lucide:x" class="size-5" />
          </button>
        </div>

        <div class="px-5 py-5">
          <div class="grid gap-3">
            <div class="border border-border-default bg-bg-deep px-4 py-4">
              <p class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Mô tả</p>
              <p class="mt-2 text-sm leading-7 text-text-primary">
                App này chỉ giữ hội thoại trong phiên hiện tại. Model được ưu tiên theo nhóm free
                models và sẽ thử fallback ngắn gọn nếu model đang chọn bị giới hạn tạm thời.
              </p>
            </div>
            <div class="border border-border-default bg-bg-deep px-4 py-4">
              <p class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Model đang chọn</p>
              <p class="mt-2 font-display text-lg text-text-primary">
                {{ selectedModelMeta?.name ?? 'OpenRouter Free Router' }}
              </p>
              <p class="mt-2 text-sm leading-7 text-text-secondary">
                {{ selectedModelMeta?.description || 'Router mặc định để tự chọn free model.' }}
              </p>
              <p class="mt-3 text-xs text-text-dim">
                Context: {{ formatContextLength(selectedModelMeta?.contextLength) }} tokens
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
