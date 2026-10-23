import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { io } from 'socket.io-client'
import type { GameState, Input, Reply, Session } from '../types'

export function usePropertyRoom() {
  const state = shallowRef<GameState>()
  const connected = ref(false),
    busy = ref(false),
    error = ref('')
  const session = useLocalStorage<Session | null>('hachitu:property-game:session:v1', null, {
    serializer: StorageSerializers.object,
  })
  const socket = io('/property-game', { autoConnect: false })
  const me = computed(() => state.value?.players.find((p) => p.id === state.value?.myId))
  async function send(action: string, input: Input = {}) {
    if (!connected.value || busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const reply = (await socket
        .timeout(10000)
        .emitWithAck('command', { action, revision: state.value?.revision, ...input })) as Reply
      if (!reply.ok) {
        error.value = reply.error || 'Không thể thực hiện thao tác.'
        return false
      }
      if (reply.session) session.value = reply.session
      return true
    } catch {
      error.value = 'Chưa nhận được phản hồi. Bàn cờ sẽ đồng bộ khi có kết nối.'
      return false
    } finally {
      busy.value = false
    }
  }
  socket.on('connect', async () => {
    connected.value = false
    if (session.value) {
      try {
        const reply = (await socket
          .timeout(10000)
          .emitWithAck('command', { action: 'resume', ...session.value })) as Reply
        if (!reply.ok) {
          if (reply.code === 'EXPIRED') {
            session.value = null
            state.value = undefined
          } else {
            error.value = reply.error || 'Chưa khôi phục được phòng.'
            return
          }
        }
      } catch {
        error.value = 'Chưa khôi phục được phòng. Hãy kết nối lại.'
        return
      }
    }
    connected.value = true
    error.value = ''
  })
  socket.on('state', (value: GameState) => {
    state.value = value
  })
  socket.on('disconnect', () => {
    connected.value = false
  })
  socket.on('connect_error', () => {
    error.value = 'Không kết nối được máy chủ. Hãy thử kết nối lại.'
  })
  socket.on('closed', (message: string) => {
    state.value = undefined
    session.value = null
    error.value = message
  })
  function reconnect() {
    socket.disconnect()
    socket.connect()
  }
  socket.connect()
  onScopeDispose(() => {
    socket.removeAllListeners()
    socket.disconnect()
  })
  return { state, me, connected, busy, error, send, reconnect }
}
