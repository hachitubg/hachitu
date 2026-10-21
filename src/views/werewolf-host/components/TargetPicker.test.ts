import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import TargetPicker from './TargetPicker.vue'
import type { Member } from '../types'

const players = Array.from({ length: 24 }, (_, i) => ({
  id: `p${i}`,
  name: i === 23 ? 'Đặng Huyền Trang' : `Người chơi ${i + 1}`,
  avatar: '',
  seat: i + 1,
})) as Member[]
it('shows 24 avatar/name targets and emits without waiting for the network', async () => {
  const wrapper = mount(TargetPicker, { props: { players, selected: [], limit: 2 } })
  expect(wrapper.findAll('.target-option')).toHaveLength(24)
  expect(wrapper.findAll('.player-avatar')).toHaveLength(24)
  const avatars = wrapper.findAll('.player-avatar').map((avatar) => avatar.element)
  await wrapper.findAll('.target-option')[23]!.trigger('click')
  expect(wrapper.emitted('select')).toEqual([['p23']])
  await wrapper.setProps({ selected: ['p23'] })
  expect(
    wrapper.findAll('.player-avatar').every((avatar, index) => avatar.element === avatars[index]),
  ).toBe(true)
  expect(wrapper.findAll('.target-option')[23]!.attributes('aria-pressed')).toBe('true')
  expect(wrapper.get('.picker-selection').text()).toContain('Đặng Huyền Trang')
  expect(wrapper.get('.picker-heading').text()).toContain('1/2')
  wrapper.unmount()
})
it('searches without accents and keeps the existing selection when filtered out', async () => {
  const wrapper = mount(TargetPicker, { props: { players, selected: ['p0'] } })
  await wrapper.get('input').setValue('dang huyen')
  expect(wrapper.findAll('.target-option')).toHaveLength(1)
  expect(wrapper.get('.target-option').text()).toContain('Đặng Huyền Trang')
  expect(wrapper.get('.picker-selection').text()).toContain('Người chơi 1')
  await wrapper.get('input').setValue('Không có người này')
  expect(wrapper.get('[role="status"]').text()).toContain('Không tìm thấy')
  wrapper.unmount()
})
it('locks targets only when disabled and avoids mounting search for small groups', async () => {
  const wrapper = mount(TargetPicker, {
    props: { players: players.slice(0, 3), selected: [], disabled: true },
  })
  expect(wrapper.find('input').exists()).toBe(false)
  expect(
    wrapper
      .findAll('.target-option')
      .every((button) => button.attributes('disabled') !== undefined),
  ).toBe(true)
  await wrapper.get('.target-option').trigger('click')
  expect(wrapper.emitted('select')).toBeUndefined()
  wrapper.unmount()
})
