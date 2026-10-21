import { readFileSync } from 'node:fs'
import { simulate } from './simulation.mjs'

const path = process.argv[2]
if (!path) throw Error('Usage: node server/werewolf/replay.mjs <failure.json>')
const { scenario } = JSON.parse(readFileSync(path, 'utf8'))
const { deck, hidden, seed, policy, faults } = scenario
try {
  console.log(JSON.stringify(simulate({ deck, hidden, seed, policy, faults }), null, 2))
} catch (error) {
  console.error(JSON.stringify({ message: error.message, scenario: error.scenario }, null, 2))
  process.exitCode = 1
}
