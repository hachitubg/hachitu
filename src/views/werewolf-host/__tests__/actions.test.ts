import { mount } from '@vue/test-utils'
import { ref, shallowRef } from 'vue'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import type { RoomState } from '../types'
const mocks = vi.hoisted(() => ({ useRoom: vi.fn() }))
vi.mock('../composables/useRoom', () => ({ useRoom: mocks.useRoom }))
import WerewolfPage from '../index.vue'

const wrappers: ReturnType<typeof mount>[] = []
const dialogMethods = ['showModal', 'close'] as const
const originalDialogMethods = dialogMethods.map((method) =>
  Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method),
)
beforeAll(() => {
  // JSDOM does not implement native dialog methods used by the confirmation UI.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false
      },
    },
  })
})
afterAll(() => {
  dialogMethods.forEach((method, index) => {
    const original = originalDialogMethods[index]
    if (original) Object.defineProperty(HTMLDialogElement.prototype, method, original)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method)
  })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})
function page(key: string, extra: Partial<RoomState> = {}) {
  const send = vi.fn().mockResolvedValue(true)
  const state = {
    code: 'ABC123',
    revision: 1,
    phase: key === 'hunter' ? 'death-action' : 'night',
    round: 2,
    game: 1,
    host: false,
    myId: 'me',
    myRole: key,
    alive: false,
    seen: true,
    paused: false,
    deadline: null,
    remainingMs: null,
    members: [
      {
        id: 'me',
        name: 'Tú',
        host: false,
        alive: false,
        connected: true,
        avatar: '',
        role: key,
        wins: 0,
        losses: 0,
      },
      {
        id: 'target',
        name: 'An',
        host: false,
        alive: true,
        connected: true,
        avatar: '',
        role: null,
        wins: 0,
        losses: 0,
      },
    ],
    deck: [],
    notes: [],
    history: [],
    logs: [],
    choices: [],
    clues: [],
    seatOrder: ['me', 'target'],
    waitingFor: [],
    current: { key, total: 1, confirmed: 0 },
    action: {
      key,
      max: key === 'ghost' ? 0 : 1,
      kind: key === 'ghost' ? 'letter' : 'targets',
      optional: true,
      options: ['target'],
      confirmed: false,
      targets: [],
      used: {},
      save: false,
      saveTarget: null,
      text: '',
      activate: false,
      wolfTarget: null,
      wolfTargets: [],
    },
    canVote: false,
    voterCount: 1,
    summary: '',
    deaths: ['me'],
    myWon: null,
    ...extra,
  } as RoomState
  mocks.useRoom.mockReturnValue({
    state: shallowRef(state),
    catalog: shallowRef([
      {
        id: key,
        name_vi: key,
        team: 'independent',
        ability_vi: 'Hướng dẫn',
        guide_vi: 'Luật đang dùng',
      },
    ]),
    busy: ref(false),
    connected: ref(true),
    error: ref(''),
    countdown: ref(0),
    send,
    reconnect: vi.fn(),
  })
  const wrapper = mount(WerewolfPage, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        Icon: true,
        RoleCard: true,
        PlayerAvatar: true,
        DeckEditor: true,
        NightJournal: true,
        AvatarPicker: true,
      },
    },
  })
  wrappers.push(wrapper)
  return { wrapper, send }
}
it('lets a dead Hunter select and confirm a target rather than showing the dead waiting screen', async () => {
  const { wrapper, send } = page('hunter')
  expect(wrapper.find('.ww-rest').exists()).toBe(false)
  await wrapper.find('.target-grid button').trigger('click')
  await wrapper.find('.night-action > .ww-primary').trigger('click')
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: ['target'] }))
})
it('lets a dead Ghost submit a letter without showing player target buttons', async () => {
  const { wrapper, send } = page('ghost')
  expect(wrapper.find('.ww-rest').exists()).toBe(false)
  expect(wrapper.find('.target-grid').exists()).toBe(false)
  await wrapper.find('[aria-label="Chữ cái của Hồn ma"]').setValue('Z')
  await wrapper.find('.night-action > .ww-primary').trigger('click')
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: [], text: 'Z' }))
})
it('does not show vote controls to a player banished by Old Hag', () => {
  const { wrapper } = page('villager', {
    phase: 'verdict',
    alive: true,
    action: null,
    canVote: false,
  })
  expect(wrapper.text()).toContain('Bạn không có quyền bỏ phiếu trong ngày này.')
  expect(wrapper.find('.verdict-options').exists()).toBe(false)
})
it('shows a personal win even when the main winning faction differs from the role team', () => {
  const { wrapper } = page('cult_leader', {
    phase: 'ended',
    alive: true,
    action: null,
    winner: 'werewolf',
    myWon: true,
  })
  expect(wrapper.text()).toContain('Bạn đã đạt điều kiện chiến thắng của mình.')
})

it('shows manual host controls without night, vote or automatic next actions', () => {
  const { wrapper } = page('villager', {
    phase: 'manual',
    host: true,
    alive: true,
    cardsOnly: true,
    canResetNight: false,
    current: null,
    action: null,
  })
  expect(wrapper.text()).toContain('Kết thúc ván')
  expect(wrapper.text()).toContain('Chuẩn bị ván mới')
  expect(wrapper.find('.host-next').exists()).toBe(false)
  expect(wrapper.find('.night-action').exists()).toBe(false)
  expect(wrapper.find('.verdict-options').exists()).toBe(false)
})

it('keeps manual finish controls private to the host', () => {
  const { wrapper } = page('villager', {
    phase: 'manual',
    alive: true,
    cardsOnly: true,
    current: null,
    action: null,
  })
  expect(wrapper.text()).toContain('Cả làng đã nhận bài')
  expect(wrapper.findAll('button').some((button) => button.text() === 'Kết thúc ván')).toBe(false)
  expect(wrapper.find('[aria-label="Xem vai trò của tôi"]').exists()).toBe(true)
})

it('requires confirmation before the host resets a night', async () => {
  const { wrapper, send } = page('villager', {
    phase: 'day',
    host: true,
    alive: true,
    canResetNight: true,
    current: null,
    action: null,
  })
  const reset = wrapper.findAll('button').find((button) => button.text() === 'Làm lại đêm 2')!
  await reset.trigger('click')
  expect(send).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('Thông tin người chơi đã xem không thể thu hồi')
  const confirm = wrapper
    .findAll('button')
    .find((button) => button.text() === 'Xác nhận làm lại đêm 2')!
  await confirm.trigger('click')
  expect(send).toHaveBeenCalledWith('reset-night')
})

it('finishes a manual game before requesting a new one and requires confirmation', async () => {
  const { wrapper, send } = page('villager', {
    phase: 'manual',
    host: true,
    alive: true,
    cardsOnly: true,
    current: null,
    action: null,
  })
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Chuẩn bị ván mới')!
    .trigger('click')
  expect(send).not.toHaveBeenCalled()
  const confirm = wrapper
    .findAll('.dialog-content button')
    .find((button) => button.text() === 'Chuẩn bị ván mới')!
  await confirm.trigger('click')
  expect(send.mock.calls.map((call) => call[0])).toEqual(['finish-manual', 'rematch'])
})
