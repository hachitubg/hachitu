import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { defaultCharacter, characterKey } from '../character-config.mjs'
vi.mock('../composables/useCharacterRenderer', () => ({
  useCharacterRenderer: () => ({ ready: ref(false), failed: ref(false), retry: vi.fn() }),
}))
import CharacterEditor from '../components/CharacterEditor.vue'

it('emits the edited full character, random changes appearance, and rotations do not change configuration', async () => {
  const wrapper = mount(CharacterEditor, {
    props: { modelValue: { ...defaultCharacter }, name: 'Tú' },
  })
  await wrapper.get('select').setValue('5')
  expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual({
    ...defaultCharacter,
    hairStyle: 5,
  })
  await wrapper.get('[aria-label="Xoay nhân vật sang trái"]').trigger('click')
  expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  await wrapper
    .findAll('button')
    .find((b) => b.text().includes('Ngẫu nhiên'))!
    .trigger('click')
  const c = wrapper.emitted('update:modelValue')?.[1]?.[0] as typeof defaultCharacter
  expect(characterKey(c)).not.toBe(characterKey(defaultCharacter))
  expect(wrapper.text()).toContain('Tú')
  wrapper.unmount()
})
it('disabled editor prevents changing appearance and ignores invisible accessory color', async () => {
  const wrapper = mount(CharacterEditor, {
    props: { modelValue: { ...defaultCharacter }, disabled: true },
  })
  expect(wrapper.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  expect(wrapper.findAll('select').every((s) => s.attributes('disabled') !== undefined)).toBe(true)
  await wrapper.setProps({ disabled: false })
  const selects = wrapper.findAll('select')
  expect(selects[selects.length - 1]!.attributes('disabled')).toBeDefined()
  wrapper.unmount()
})
