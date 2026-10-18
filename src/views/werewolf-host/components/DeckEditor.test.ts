import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import DeckEditor from './DeckEditor.vue'
import type { Role } from '../types'

it('shows only current cards, opens the library on click, then saves a one-slot replacement', async () => {
  const roles = ['werewolf', 'villager', 'seer', 'witch', 'bodyguard'].map((id) => ({
    id,
    name_vi: id,
    team: 'village',
    quantity: id === 'villager' ? 12 : id === 'werewolf' ? 8 : 1,
    enabled: true,
    balance_points: 1,
    ability_vi: '',
    win_condition_vi: '',
  })) as Role[]
  const wrapper = mount(DeckEditor, {
    props: {
      deck: ['werewolf', 'villager', 'villager', 'seer', 'bodyguard'],
      count: 5,
      roles,
      revision: 1,
      disabled: false,
    },
    global: {
      stubs: {
        Icon: true,
        RoleCard: { props: ['role'], template: '<div>{{ role.name_vi }}</div>' },
      },
    },
  })
  expect(wrapper.findAll('.selected-deck-slot')).toHaveLength(5)
  expect(wrapper.find('.replacement-grid').exists()).toBe(false)
  expect(wrapper.find('.selected-card-ability').element.hasAttribute('open')).toBe(false)
  expect(wrapper.text()).not.toContain('Đổi lá này')
  await wrapper.find('[aria-label="Đổi lá 2: villager"]').trigger('click')
  expect(wrapper.find('.selected-deck-grid').exists()).toBe(false)
  expect(wrapper.findAll('.replacement-card')).toHaveLength(5)
  expect(wrapper.find('[aria-label="Chọn seer thay lá 2"]').attributes('disabled')).toBeDefined()
  await wrapper.find('[aria-label="Chọn witch thay lá 2"]').trigger('click')
  expect(wrapper.findAll('.selected-deck-slot')).toHaveLength(5)
  expect(wrapper.find('.replacement-grid').exists()).toBe(false)
  await wrapper.find('.sticky-save').trigger('click')
  expect(wrapper.emitted('save')).toEqual([
    [['werewolf', 'witch', 'villager', 'seer', 'bodyguard']],
  ])
  wrapper.unmount()
})

it('read-only preview shows the deck without editing, saving or hidden Drunk reserve controls', async () => {
  const wrapper = mount(DeckEditor, {
    props: {
      deck: ['werewolf', 'drunk', 'villager', 'villager', 'villager'],
      count: 5,
      roles: ['werewolf', 'drunk', 'villager'].map((id) => ({
        id,
        name_vi: id,
        quantity: 12,
        enabled: true,
        balance_points: 0,
        ability_vi: 'Chi tiết vai',
      })) as Role[],
      revision: 1,
      disabled: false,
      readonly: true,
    },
    global: { stubs: { Icon: true, RoleCard: true } },
  })
  expect(wrapper.findAll('.selected-deck-slot')).toHaveLength(5)
  expect(wrapper.find('.sticky-save').exists()).toBe(false)
  expect(wrapper.find('.drunk-reserve').exists()).toBe(false)
  expect(wrapper.find('.deck-status button').exists()).toBe(false)
  await wrapper.find('.selected-deck-slot').trigger('click')
  expect(wrapper.find('.replacement-grid').exists()).toBe(false)
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(wrapper.emitted('suggest')).toBeUndefined()
  wrapper.unmount()
})
