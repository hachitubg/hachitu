import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { StorageSerializers, useLocalStorage, useTimestamp } from '@vueuse/core'
import { io } from 'socket.io-client'
import type { Input, Reply, Role, RoomState, Session } from '../types'

export function useRoom() {
  const state = shallowRef<RoomState>()
  const catalog = shallowRef<Role[]>([])
  const error = ref('')
  const connected = ref(false)
  const busy = ref(false)
  const session = useLocalStorage<Session | null>('hachitu:werewolf:v2:session', null, {
    serializer: StorageSerializers.object,
  })
  const now = useTimestamp({ interval: 250 })
  const offset = ref(0)
  const countdown = computed(() =>
    state.value?.deadline
      ? Math.max(
          0,
          Math.ceil(
            (state.value.paused
              ? state.value.remainingMs || 0
              : state.value.deadline - now.value - offset.value) / 1000,
          ),
        )
      : 0,
  )
  const socket = io('/werewolf', { autoConnect: false, reconnection: true })
  async function send(action: string, data: Input = {}) {
    if (!connected.value) {
      error.value = 'Đang kết nối lại với phòng…'
      return false
    }
    if (busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const reply = (await socket
        .timeout(10000)
        .emitWithAck('command', { action, revision: state.value?.revision, ...data })) as Reply
      if (!reply.ok) {
        error.value = reply.error || 'Không thực hiện được thao tác.'
        return false
      }
      if (reply.session) session.value = reply.session
      return true
    } catch {
      error.value = 'Chưa nhận được phản hồi. Hãy kiểm tra kết nối và thử lại.'
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
          error.value = reply.error || 'Phòng đã hết hạn.'
          if (['SESSION_EXPIRED', 'SESSION_INVALID'].includes(reply.code || '')) {
            session.value = null
            state.value = undefined
          } else return
        } else error.value = ''
      } catch {
        error.value = 'Chưa khôi phục được kết nối. Phiên chơi vẫn được giữ trên thiết bị.'
        return
      }
    }
    connected.value = true
  })
  socket.on('disconnect', () => {
    connected.value = false
  })
  socket.on('connect_error', () => {
    error.value = 'Không kết nối được phòng chơi. Hãy kiểm tra server hoặc thử lại.'
  })
  socket.on('catalog', (value: Role[]) => {
    catalog.value = value
  })
  socket.on('state', (value: RoomState) => {
    state.value = value
    offset.value = value.serverTime - Date.now()
  })
  socket.on('closed', (message: string) => {
    state.value = undefined
    session.value = null
    error.value = message
  })
  socket.connect()
  function reconnect() {
    socket.disconnect()
    socket.connect()
  }
  onScopeDispose(() => {
    socket.removeAllListeners()
    socket.disconnect()
  })
  return { state, catalog, error, busy, connected, countdown, send, reconnect }
}
