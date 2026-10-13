import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ScoreBoard from './index.vue'

vi.mock('@iconify/vue', () => ({ Icon: { template: '<span />' } }))
vi.mock('html-to-image', () => ({ toPng: vi.fn() }))

function createBoard(balanceCheck = true) {
  localStorage.setItem(
    'hachitu-score-board',
    JSON.stringify({
      name: 'Test',
      players: ['An', 'Bình', 'Chi', 'Dũng'].map((name, id) => ({
        id: String(id),
        name,
        color: '#d9654f',
      })),
      rounds: [{ '0': 3, '1': -1, '2': -1, '3': -1 }],
      config: { autoSort: true, balanceCheck },
      phase: 'playing',
    }),
  )
  return mount(ScoreBoard, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}

let board: ReturnType<typeof createBoard>
function score(name: string) {
  return board.get<HTMLInputElement>(`input[aria-label="Điểm ván của ${name}"]`)
}
async function click(label: string) {
  const button = board.findAll('button').find((item) => item.text().includes(label))
  if (!button) throw new Error(`Missing button: ${label}`)
  await button.trigger('click')
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  board?.unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  localStorage.clear()
})

describe('Automatic last-unentered score', () => {
  it('keeps every input editable and fills the remaining person regardless of row order', async () => {
    board = createBoard()
    expect(board.text()).not.toContain('Đã tự điền')
    for (const input of board.findAll('input')) expect(input.attributes('readonly')).toBeUndefined()
    await score('Dũng').setValue('10')
    await score('An').setValue('-3')
    expect(score('Bình').element.value).toBe('0')
    await score('Chi').setValue('5')
    expect(score('Bình').element.value).toBe('-12')
    await score('Dũng').setValue('20')
    expect(score('Bình').element.value).toBe('-22')
    await score('Bình').setValue('1')
    expect(score('Bình').element.value).toBe('1')
    expect(board.text()).toContain('Chưa cân bằng')
    await score('Dũng').setValue('10')
    expect(score('Bình').element.value).toBe('1')
    expect(board.get('button[class*="flex-1 border py"]').attributes('disabled')).toBeDefined()
  })

  it('counts an explicitly entered zero, but not an empty or unfinished input', async () => {
    board = createBoard()
    await score('An').setValue('0')
    await score('Bình').setValue('5')
    await score('Chi').setValue('-')
    expect(score('Dũng').element.value).toBe('0')
    await score('Chi').setValue('-2')
    expect(score('Dũng').element.value).toBe('-3')
    await score('Dũng').setValue('')
    expect(score('Dũng').element.value).toBe('')
    await score('Dũng').trigger('blur')
    expect(score('Dũng').element.value).toBe('0')
    expect(board.text()).toContain('Chưa cân bằng')
  })

  it('allows quick buttons to override the auto-filled score', async () => {
    board = createBoard()
    await score('An').setValue('10')
    await score('Bình').setValue('-3')
    await score('Chi').setValue('5')
    const quickButtons = board.findAll('button').filter((button) => button.text() === '+3')
    expect(quickButtons).toHaveLength(4)
    await quickButtons[3]!.trigger('click')
    expect(score('Dũng').element.value).toBe('-9')
    expect(board.text()).toContain('Chưa cân bằng')
  })

  it('resets entry tracking each round and can fill a different person next round', async () => {
    board = createBoard()
    await score('An').setValue('10')
    await score('Bình').setValue('-3')
    await score('Chi').setValue('5')
    await click('XÁC NHẬN VÁN')
    expect(board.text()).not.toContain('Đã tự điền')
    expect(score('Dũng').element.value).toBe('0')
    await score('Dũng').setValue('4')
    await score('Bình').setValue('2')
    await score('Chi').setValue('1')
    expect(score('An').element.value).toBe('-7')
  })

  it('does not auto-fill with balance mode disabled', async () => {
    board = createBoard(false)
    await score('An').setValue('10')
    await score('Bình').setValue('-3')
    await score('Chi').setValue('5')
    expect(score('Dũng').element.value).toBe('0')
  })

  it('returns from the end screen with saved rounds and pending edits intact', async () => {
    board = createBoard()
    await score('Dũng').setValue('10')
    await score('An').setValue('-3')
    await score('Chi').setValue('5')
    await score('Bình').setValue('-11')
    await click('Kết thúc')
    expect(board.text()).toContain('1 ván · HACHITU')
    await click('Quay lại chơi')
    expect(board.text()).toContain('Ván 2')
    expect(score('An').element.value).toBe('-3')
    expect(score('Bình').element.value).toBe('-11')
    expect(score('Chi').element.value).toBe('5')
    expect(score('Dũng').element.value).toBe('10')
    expect(board.text()).toContain('Chưa cân bằng')
  })
})
