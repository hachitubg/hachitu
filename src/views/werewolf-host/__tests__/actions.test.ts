import { mount, flushPromises } from '@vue/test-utils'
import { ref, shallowRef } from 'vue'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import type { RoomState, Member } from '../types'
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
  vi.useRealTimers()
})
function page(
  key: string,
  extra: Partial<RoomState> = {},
  actionOverrides: Partial<NonNullable<RoomState['action']>> = {},
) {
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
      ...actionOverrides,
    },
    canVote: false,
    voterCount: 1,
    summary: '',
    deaths: ['me'],
    myWon: null,
    ...extra,
  } as RoomState
  const roomState = shallowRef(state)
  mocks.useRoom.mockReturnValue({
    state: roomState,
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
  return { wrapper, send, roomState }
}
async function confirmSelection(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('.night-action .action-submit > .ww-primary').trigger('click')
  await flushPromises()
}

it('lets the player change targets during a slow draft and confirms only the latest choice', async () => {
  vi.useFakeTimers()
  const members = [
    { id: 'target', name: 'An', alive: true, avatar: '', seat: 1 },
    { id: 'second', name: 'Bình', alive: true, avatar: '', seat: 2 },
  ] as Member[]
  const { wrapper, send } = page(
    'seer',
    { alive: true, members },
    { options: ['target', 'second'], optional: false },
  )
  let resolveFirst!: (value: boolean) => void
  send.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        resolveFirst = resolve
      }),
  )
  await wrapper.findAll('.target-grid button')[0]!.trigger('click')
  await vi.advanceTimersByTimeAsync(100)
  expect(wrapper.findAll('.target-grid button')[1]!.attributes('disabled')).toBeUndefined()
  await wrapper.findAll('.target-grid button')[1]!.trigger('click')
  expect(wrapper.findAll('.target-grid button')[1]!.attributes('aria-pressed')).toBe('true')
  await wrapper.get('.night-action .action-submit > .ww-primary').trigger('click')
  expect(send.mock.calls.map((call) => call[0])).toEqual(['draft'])
  resolveFirst(false)
  await flushPromises()
  expect(send.mock.calls.map((call) => [call[0], call[1].targets])).toEqual([
    ['draft', ['target']],
    ['draft', ['second']],
    ['confirm', ['second']],
  ])
})

it('does not confirm a previous turn after an old draft finishes', async () => {
  const { wrapper, send, roomState } = page('seer', { alive: true })
  let resolveDraft!: (value: boolean) => void
  send.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        resolveDraft = resolve
      }),
  )
  await wrapper.get('.target-grid button').trigger('click')
  await wrapper.get('.night-action .action-submit > .ww-primary').trigger('click')
  roomState.value = { ...roomState.value, revision: 2, phase: 'day', current: null, action: null }
  await wrapper.vm.$nextTick()
  resolveDraft(true)
  await flushPromises()
  expect(send.mock.calls.map((call) => call[0])).toEqual(['draft'])
})

it('hides the private role popup on blur while retaining the selected target', async () => {
  const { wrapper } = page('seer', { alive: true })
  await wrapper.get('.target-grid button').trigger('click')
  await wrapper.get('[aria-label="Xem vai trò của tôi"]').trigger('click')
  expect(wrapper.find('.private-role-preview').exists()).toBe(true)
  window.dispatchEvent(new Event('blur'))
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.private-role-preview').exists()).toBe(false)
  expect(wrapper.get('.target-grid button').attributes('aria-pressed')).toBe('true')
})
it('lets a dead Hunter select and confirm a target rather than showing the dead waiting screen', async () => {
  const { wrapper, send } = page('hunter')
  expect(wrapper.find('.ww-rest').exists()).toBe(false)
  await wrapper.find('.target-grid button').trigger('click')
  await confirmSelection(wrapper)
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: ['target'] }))
})

it('Big Bad Wolf can confirm one victim without being forced to select two', async () => {
  const { wrapper, send } = page(
    'wolves',
    { alive: true, myRole: 'big_bad_wolf' },
    { min: 1, max: 2, optional: false, adjacentPair: true, pairs: [] },
  )
  await wrapper.get('.target-grid button').trigger('click')
  expect(wrapper.get('.target-grid button').attributes('aria-pressed')).toBe('true')
  const confirm = wrapper.get('.night-action .action-submit > .ww-primary')
  expect(confirm.attributes('disabled')).toBeUndefined()
  await confirm.trigger('click')
  await flushPromises()
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: ['target'] }))
})
it('lets a dead Ghost submit a letter without showing player target buttons', async () => {
  const { wrapper, send } = page('ghost')
  expect(wrapper.find('.ww-rest').exists()).toBe(false)
  expect(wrapper.find('.target-grid').exists()).toBe(false)
  await wrapper.find('[aria-label="Chữ cái của Hồn ma"]').setValue('Z')
  await confirmSelection(wrapper)
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: [], text: 'Z' }))
})

it('lets Revealer skip the night or confirm one target with a one-use explanation', async () => {
  const { wrapper, send } = page('revealer', { alive: true })
  expect(wrapper.text()).toContain('Cả ván chỉ có một lượt khám phá')
  await confirmSelection(wrapper)
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: [] }))
  await wrapper.get('.target-grid button').trigger('click')
  await confirmSelection(wrapper)
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: ['target'] }))
})

it('Martyr can explicitly volunteer or decline before the host executes anyone', async () => {
  const { wrapper, send } = page(
    'martyr',
    { phase: 'martyr', alive: true, nominee: 'target' },
    { kind: 'activate', max: 0, options: [] },
  )
  expect(wrapper.text()).toContain('Kẻ tử đạo có cứu An không?')
  expect(wrapper.find('.target-grid').exists()).toBe(false)
  await wrapper.get('.night-action .potion input').setValue(true)
  await confirmSelection(wrapper)
  expect(send).toHaveBeenCalledWith(
    'confirm',
    expect.objectContaining({ targets: [], activate: true }),
  )
})

it('Bloody Mary receives target controls while dead, without the dead waiting overlay', async () => {
  const { wrapper, send } = page('bloody_mary')
  expect(wrapper.find('.ww-rest').exists()).toBe(false)
  await wrapper.get('.target-grid button').trigger('click')
  await confirmSelection(wrapper)
  expect(send).toHaveBeenCalledWith('confirm', expect.objectContaining({ targets: ['target'] }))
})

it('Teen wolf review controls are host-only and require every check before continuing', async () => {
  const { wrapper, send } = page('villager', {
    phase: 'teen-review',
    host: true,
    alive: true,
    action: null,
    current: null,
    teenChecks: [{ id: 'target', spoken: null }],
  })
  expect(wrapper.get('.host-next').attributes('disabled')).toBeDefined()
  await wrapper
    .findAll('.teen-review-list button')
    .find((button) => button.text() === 'Đã nói từ khóa')!
    .trigger('click')
  expect(send).toHaveBeenCalledWith('teen-check', { playerId: 'target', spoken: true })
  const player = page('villager', {
    phase: 'teen-review',
    alive: true,
    action: null,
    current: null,
    teenChecks: [],
  }).wrapper
  expect(player.find('.teen-review-list').exists()).toBe(false)
})

it('Leprechaun chooses a bite source and sends a neighbor as the redirect target', async () => {
  const members = [
    { id: 'me', name: 'Tú', alive: true, host: false },
    { id: 'source', name: 'Bình', alive: true, host: false },
    { id: 'target', name: 'An', alive: true, host: false },
  ] as Member[]
  const { wrapper, send } = page(
    'leprechaun',
    { alive: true, members, seatOrder: ['me', 'source', 'target'] },
    { wolfTargets: ['source'] },
  )
  await wrapper.get('[aria-label="Nạn nhân Sói muốn chuyển"]').setValue('source')
  await wrapper.get('.target-grid button').trigger('click')
  expect(wrapper.get('.target-grid button').attributes('aria-pressed')).toBe('true')
  expect(
    wrapper.get('.night-action .action-submit > .ww-primary').attributes('disabled'),
  ).toBeUndefined()
  await confirmSelection(wrapper)
  expect(send).toHaveBeenCalledWith(
    'confirm',
    expect.objectContaining({ targets: ['target'], redirectFrom: 'source' }),
  )
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
