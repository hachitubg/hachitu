import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import sourceDeck from '../../../../public/werewolf-host/deck.json'
import CardLibrary from './CardLibrary.vue'
import { artStyle } from '../types'
import type { Role } from '../types'

const roles: Role[] = sourceDeck.sets.flatMap((set) =>
  set.roles.map((role) => ({ ...role, enabled: role.team !== 'utility', set: set.name_vi })),
)

it('hides utility cards and combines accent-insensitive search with faction filtering', async () => {
  const wrapper = mount(CardLibrary, { props: { roles } })
  expect(wrapper.findAll('.library-card')).toHaveLength(67)
  expect(
    wrapper.findAll('.library-card h3').some((el) => /Quản trò|Thẻ trống/.test(el.text())),
  ).toBe(false)
  await wrapper.get('input').setValue('ĐƠN ĐỘC')
  expect(wrapper.findAll('.library-card')).toHaveLength(1)
  expect(wrapper.get('.library-card h3').text()).toContain('đơn độc')
  const village = wrapper
    .findAll('.library-factions button')
    .find((button) => button.text() === 'Phe Dân làng')!
  await village.trigger('click')
  expect(wrapper.findAll('.library-card')).toHaveLength(0)
  expect(wrapper.get('[role="status"]').text()).toContain('Không tìm thấy')
})

it('assigns a distinct portrait tile to each of the 67 character roles', () => {
  const portraits = roles
    .filter((role) => role.team !== 'utility')
    .map((role) => JSON.stringify(artStyle(role.id)))
  expect(new Set(portraits).size).toBe(67)
})

it('filters unused roles independently of search and faction, keeping total counts visible', async () => {
  const sample = roles.map((role) => ({
    ...role,
    enabled: ['villager', 'werewolf'].includes(role.id),
  }))
  const wrapper = mount(CardLibrary, { props: { roles: sample } })
  const filters = wrapper.findAll('.library-availability button')
  expect(filters.map((button) => button.text())).toEqual([
    'Tất cả (67)',
    'Đang sử dụng (2)',
    'Chưa sử dụng (65)',
  ])
  await filters[1]!.trigger('click')
  expect(wrapper.findAll('.library-card')).toHaveLength(2)
  expect(wrapper.findAll('.unavailable')).toHaveLength(0)
  await filters[2]!.trigger('click')
  expect(wrapper.findAll('.library-card')).toHaveLength(65)
  expect(wrapper.findAll('.unavailable')).toHaveLength(65)
  await wrapper.get('input').setValue('tien tri')
  expect(wrapper.findAll('.library-card').length).toBeGreaterThan(0)
  expect(
    wrapper
      .findAll('.library-card h3')
      .every((heading) => heading.text().toLocaleLowerCase('vi').includes('tiên tri')),
  ).toBe(true)
  expect(filters[2]!.text()).toContain('(65)')
  await filters[0]!.trigger('click')
  await wrapper.get('input').setValue('')
  expect(wrapper.findAll('.library-card')).toHaveLength(67)
  wrapper.unmount()
})
