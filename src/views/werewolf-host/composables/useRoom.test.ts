import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { Reply, Role, RoomState } from '../types'

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (value?: string | Role[] | RoomState) => void | Promise<void>>()
  const socket = {
    on: vi.fn(
      (name: string, callback: (value?: string | Role[] | RoomState) => void | Promise<void>) => {
        handlers.set(name, callback)
      },
    ),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    timeout: vi.fn(),
    emitWithAck: vi.fn<() => Promise<Reply>>(),
  }
  return { handlers, socket }
})
vi.mock('socket.io-client', () => ({ io: () => mocks.socket }))
import { useRoom } from './useRoom'

const storageKey = 'hachitu:werewolf:v2:session'
const saved = { code: 'ABC123', id: 'player-id', token: 'private-token' }
let scope = effectScope()
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  mocks.handlers.clear()
  vi.clearAllMocks()
  mocks.socket.timeout.mockReturnValue(mocks.socket)
  mocks.socket.emitWithAck.mockResolvedValue({ ok: true })
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  vi.useRealTimers()
  localStorage.clear()
})

describe('werewolf client session recovery', () => {
  it('does not lock target buttons for a draft or release the lock of an active confirmation', async () => {
    const room = scope.run(useRoom)!
    await mocks.handlers.get('connect')!()
    let resolveDraft!: (reply: Reply) => void
    let resolveConfirm!: (reply: Reply) => void
    mocks.socket.emitWithAck
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDraft = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveConfirm = resolve
          }),
      )
    const draft = room.send('draft', { targets: ['a'] })
    expect(room.busy.value).toBe(false)
    const confirm = room.send('confirm', { targets: ['a'] })
    expect(room.busy.value).toBe(true)
    resolveDraft({ ok: true })
    await draft
    expect(room.busy.value).toBe(true)
    resolveConfirm({ ok: true })
    await confirm
    expect(room.busy.value).toBe(false)
  })
  it('ignores draft errors from a previous turn', async () => {
    const room = scope.run(useRoom)!
    await mocks.handlers.get('connect')!()
    await mocks.handlers.get('state')!({
      code: 'ABC123',
      revision: 1,
      serverTime: Date.now(),
    } as RoomState)
    let resolveDraft!: (reply: Reply) => void
    mocks.socket.emitWithAck.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDraft = resolve
        }),
    )
    const draft = room.send('draft', { revision: 1, targets: ['a'] })
    await mocks.handlers.get('state')!({
      code: 'ABC123',
      revision: 2,
      serverTime: Date.now(),
    } as RoomState)
    resolveDraft({ ok: false, error: 'Lỗi của lượt cũ' })
    expect(await draft).toBe(false)
    expect(room.error.value).toBe('')
  })
  it('rehydrates stored JSON into a resume credential object', async () => {
    localStorage.setItem(storageKey, JSON.stringify(saved))
    const room = scope.run(useRoom)!
    await mocks.handlers.get('connect')!()
    expect(mocks.socket.emitWithAck).toHaveBeenCalledWith('command', { action: 'resume', ...saved })
    expect(room.connected.value).toBe(true)
  })
  it('retains credentials on a temporary rejection and supports retry', async () => {
    localStorage.setItem(storageKey, JSON.stringify(saved))
    mocks.socket.emitWithAck.mockResolvedValueOnce({
      ok: false,
      code: 'RATE_LIMIT',
      error: 'Thử lại',
    })
    const room = scope.run(useRoom)!
    await mocks.handlers.get('connect')!()
    expect(room.connected.value).toBe(false)
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(saved)
    room.reconnect()
    expect(mocks.socket.disconnect).toHaveBeenCalled()
    await mocks.handlers.get('connect')!()
    expect(room.connected.value).toBe(true)
    expect(room.error.value).toBe('')
  })
  it('clears an expired room instead of repeatedly trying the invalid identity', async () => {
    localStorage.setItem(storageKey, JSON.stringify(saved))
    mocks.socket.emitWithAck.mockResolvedValueOnce({
      ok: false,
      code: 'SESSION_EXPIRED',
      error: 'Hết buổi chơi',
    })
    const room = scope.run(useRoom)!
    await mocks.handlers.get('connect')!()
    await nextTick()
    expect(localStorage.getItem(storageKey)).toBeNull()
    expect(room.state.value).toBeUndefined()
    expect(room.connected.value).toBe(true)
  })
  it('freezes a paused countdown until a new server state resumes it', async () => {
    const room = scope.run(useRoom)!
    const time = Date.now()
    await mocks.handlers.get('state')!({
      deadline: time + 5000,
      serverTime: time,
      paused: true,
      remainingMs: 4000,
    } as RoomState)
    expect(room.countdown.value).toBe(4)
    vi.advanceTimersByTime(3000)
    expect(room.countdown.value).toBe(4)
    await mocks.handlers.get('state')!({
      deadline: Date.now() + 4000,
      serverTime: Date.now(),
      paused: false,
      remainingMs: 4000,
    } as RoomState)
    vi.advanceTimersByTime(1000)
    expect(room.countdown.value).toBe(3)
  })
})
