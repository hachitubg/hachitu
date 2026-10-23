import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { defaultCharacter, characterRanges } from '../../src/views/co-ty-phu/character-config.mjs'

test('vendored renderer draws every customization in eight directions without invalid canvas coordinates', () => {
  const sandbox = { window: {} }
  const script = readFileSync(
    new URL('../../public/co-ty-phu/vendor/sprites.js', import.meta.url),
    'utf8',
  )
  runInNewContext(script, sandbox)
  assert.equal(typeof sandbox.window.HachiCharacterRenderer?.drawAvatar, 'function')
  let calls = 0
  const context = new Proxy(
    {},
    {
      get: (_object, name) =>
        name === 'measureText'
          ? () => ({ width: 30 })
          : (...args) => {
              calls++
              for (const arg of args)
                if (typeof arg === 'number') assert.ok(Number.isFinite(arg), String(name))
            },
      set: () => true,
    },
  )
  let draws = 0
  for (const [key, count] of Object.entries(characterRanges))
    for (let value = 0; value < count; value++) {
      for (const direction of ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']) {
        sandbox.window.HachiCharacterRenderer.drawAvatar(context, 24, 59, {
          avatar: {
            ...defaultCharacter,
            [key]: value,
            customShoes: '#24282d',
            customAccessory: '#d9654f',
          },
          direction,
          isWalking: true,
          walkFrame: 8,
          hideName: true,
        })
        draws++
      }
    }
  assert.ok(draws > 500)
  assert.ok(calls > draws * 20)
  // A second script execution on SPA navigation is safe after the IIFE adaptation.
  assert.doesNotThrow(() => runInNewContext(script, sandbox))
})
