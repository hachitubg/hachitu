import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref, shallowRef } from 'vue'
import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest'
import type { GameState } from '../types'
const mocks = vi.hoisted(() => ({ room: vi.fn() }))
vi.mock('../composables/usePropertyRoom', () => ({ usePropertyRoom: mocks.room }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  RouterLink: { template: '<a><slot /></a>' },
}))
import GamePage from '../index.vue'

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false
    },
  })
})
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShow)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.clearAllMocks()
})
function page(extra: Partial<GameState> = {}) {
  const state = shallowRef<GameState>({
    code: 'ABCDEF',
    myId: 'a',
    hostId: 'a',
    phase: 'roll',
    revision: 1,
    turn: 0,
    turnNumber: 1,
    dice: [2, 3],
    again: false,
    paused: false,
    board: [
      { id: 0, name: 'Khởi hành', kind: 'go' },
      {
        id: 1,
        name: 'Hội An',
        kind: 'street',
        price: 60,
        houseCost: 50,
        rents: [2, 10, 30, 90, 160, 250],
        group: 'sand',
      },
    ],
    properties: [{ id: 1, owner: 'a', level: 0, mortgaged: false }],
    players: [
      {
        id: 'a',
        name: 'An',
        token: 'car',
        connected: true,
        ready: true,
        cash: 1500,
        worth: 1560,
        position: 0,
        jail: false,
        jailTurns: 0,
        jailCards: 0,
        bankrupt: false,
      },
      {
        id: 'b',
        name: 'Bình',
        token: 'cat',
        connected: true,
        ready: true,
        cash: 1500,
        worth: 1500,
        position: 0,
        jail: false,
        jailTurns: 0,
        jailCards: 0,
        bankrupt: false,
      },
    ],
    settings: { startingCash: 1500, timeLimit: 0, parkingPot: false, doubleGo: false },
    houses: 32,
    hotels: 12,
    pot: 0,
    logs: [],
    winnerIds: [],
    debt: null,
    trade: null,
    auction: null,
    card: null,
    ...extra,
  })
  const send = vi.fn().mockResolvedValue(true),
    busy = ref(false)
  mocks.room.mockReturnValue({
    state,
    me: computed(() => state.value.players.find((p) => p.id === 'a')),
    connected: ref(true),
    busy,
    error: ref(''),
    send,
    reconnect: vi.fn(),
  })
  const wrapper = mount(GamePage)
  wrappers.push(wrapper)
  return { wrapper, state, send, busy }
}
it('only current player can roll and pause disables action', async () => {
  const { wrapper, state, send } = page()
  await wrapper.get('.roll-button').trigger('click')
  expect(send).toHaveBeenCalledWith('roll', {})
  state.value = { ...state.value, paused: true }
  await flushPromises()
  expect(wrapper.get('.roll-button').attributes('disabled')).toBeDefined()
  state.value = { ...state.value, paused: false, turn: 1 }
  await flushPromises()
  expect(wrapper.find('.roll-button').exists()).toBe(false)
})
it('property details show rent/mortgage and only owners get management controls', async () => {
  const { wrapper, state } = page()
  await wrapper.get('[aria-label="1. Hội An, giá 60"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('dialog:not(.decision-dialog)').text()).toContain('Khách sạn')
  expect(wrapper.find('.asset-actions').exists()).toBe(true)
  state.value = { ...state.value, properties: [{ id: 1, owner: 'b', level: 0, mortgaged: false }] }
  await flushPromises()
  expect(wrapper.find('.asset-actions').exists()).toBe(false)
})
it('bankruptcy asks confirmation and does not send on opening', async () => {
  const { wrapper, send } = page({
    phase: 'debt',
    debt: { from: 'a', to: 'b', amount: 2000, reason: 'thuê' },
  })
  await wrapper.get('.turn-panel .danger').trigger('click')
  await flushPromises()
  expect(send).not.toHaveBeenCalled()
  await wrapper.get('dialog:not(.decision-dialog) .danger').trigger('click')
  expect(send).toHaveBeenCalledWith('bankrupt', {})
})
it('trade recipient can accept exact proposal; unrelated player cannot accept', async () => {
  const { wrapper, state, send } = page({
    trade: { from: 'b', to: 'a', give: [], take: [1], giveCash: 200, receiveCash: 0 },
  })
  expect(wrapper.get('.trade-summary').text()).toContain('Hội An')
  await wrapper.get('.turn-panel .primary').trigger('click')
  expect(send).toHaveBeenCalledWith('trade-reply', { accept: true })
  state.value = {
    ...state.value,
    trade: { from: 'a', to: 'b', give: [1], take: [], giveCash: 0, receiveCash: 200 },
  }
  await flushPromises()
  expect(wrapper.find('.turn-panel .primary').exists()).toBe(false)
})
it('required purchase opens only the central action dialog after movement and closes when resolved', async () => {
  const { wrapper, state, send } = page({ phase: 'buy' })
  await flushPromises()
  const decision = wrapper.get('dialog.decision-dialog')
  expect((decision.element as HTMLDialogElement).open).toBe(true)
  expect(decision.text()).toContain('Mua tài sản')
  expect(wrapper.find('.game-sidebar .turn-panel').exists()).toBe(false)
  state.value = { ...state.value, phase: 'end' }
  await flushPromises()
  expect((decision.element as HTMLDialogElement).open).toBe(false)
  expect(send).not.toHaveBeenCalled()
})
it('host can add a machine in the lobby and machines are visibly identified', async () => {
  const { wrapper, send } = page({ phase: 'lobby' })
  await wrapper.get('.add-bot').trigger('click')
  expect(send).toHaveBeenCalledWith('add-bot', {})
})
it('property upgrade changes the actual board artwork and large development preview', async () => {
  const { wrapper, state } = page()
  await wrapper.get('[aria-label="1. Hội An, giá 60"]').trigger('click')
  state.value = { ...state.value, properties: [{ id: 1, owner: 'a', level: 3, mortgaged: false }] }
  await flushPromises()
  expect(wrapper.get('.property-development').text()).toContain('3 nhà')
  state.value = { ...state.value, properties: [{ id: 1, owner: 'a', level: 5, mortgaged: false }] }
  await flushPromises()
  expect(wrapper.get('.property-development').text()).toContain('Khách sạn')
})
it('game information opens via its toolbar rather than occupying the main play area', async () => {
  const { wrapper } = page()
  await flushPromises()
  expect(wrapper.find('.game-sidebar .portfolio').exists()).toBe(false)
  await wrapper.get('[aria-label="Tài sản của tôi"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('dialog:not(.decision-dialog)').text()).toContain('Tài sản của bạn')
})
