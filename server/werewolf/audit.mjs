import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { combinations, combinationDeck, randomDeck, simulate } from './simulation.mjs'
import { SUPPORTED } from './engine.mjs'

const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.slice(7) || 'full'
if (!['smoke', 'ci', 'full'].includes(mode)) throw Error('Use --mode=smoke|ci|full')
const directory = new URL('./test-results/', import.meta.url)
mkdirSync(directory, { recursive: true })
const started = performance.now()
const report = {
  engineSha256: createHash('sha256')
    .update(readFileSync(new URL('./engine.mjs', import.meta.url)))
    .digest('hex'),
  simulationSha256: createHash('sha256')
    .update(readFileSync(new URL('./simulation.mjs', import.meta.url)))
    .digest('hex'),
  seedPlan: {
    pairs: '50001 + pairIndex * 13 + policyIndex',
    triples: '1000001 + tripleIndex * 7',
    random: '9000001 + gameIndex * 31',
  },
  mode,
  roles: SUPPORTED.length,
  passed: 0,
  failed: 0,
  commands: 0,
  pairsRequired: combinations(2).length,
  triplesRequired: combinations(3).length,
  pairCombinationsPassed: 0,
  tripleCombinationsPassed: 0,
  randomGamesPassed: 0,
  resetCount: 0,
  disconnectCount: 0,
  rejectedCount: 0,
  phaseVisits: {},
  actionVisits: {},
  deathCauses: {},
  populationGames: {},
  rolePresence: {},
  failures: [],
}
function merge(destination, source) {
  for (const [key, count] of Object.entries(source))
    destination[key] = (destination[key] || 0) + count
}
function save() {
  report.durationSeconds = Number(((performance.now() - started) / 1000).toFixed(2))
  writeFileSync(new URL(`audit-${mode}.json`, directory), JSON.stringify(report, null, 2) + '\n')
}
function run(kind, keys, scenario) {
  try {
    const result = simulate(scenario)
    report.passed++
    report.commands += result.commands
    report.resetCount += result.resets
    report.disconnectCount += result.disconnects
    report.rejectedCount += result.rejected
    merge(report.phaseVisits, result.phases)
    merge(report.actionVisits, result.actions)
    merge(report.deathCauses, result.deaths)
    merge(report.populationGames, { [result.players]: 1 })
    merge(report.rolePresence, Object.fromEntries([...new Set(scenario.deck)].map((id) => [id, 1])))
    return true
  } catch (error) {
    report.failed++
    const failure = {
      kind,
      keys,
      message: error.message,
      stack: error.stack,
      scenario: error.scenario || scenario,
    }
    report.failures.push(failure)
    writeFileSync(
      new URL(`failure-${mode}-${report.failed}.json`, directory),
      JSON.stringify(failure, null, 2) + '\n',
    )
    console.error(`FAIL ${kind} ${keys.join(',')} seed=${scenario.seed}: ${error.message}`)
    if (report.failed >= 8) {
      save()
      throw Error('Stopped after eight reproducible failures; fix before continuing')
    }
    return false
  } finally {
    if ((report.passed + report.failed) % 500 === 0) {
      save()
      console.log(
        `Progress: ${report.passed} passed, ${report.failed} failed, ${report.durationSeconds}s`,
      )
    }
  }
}

console.log(
  `Werewolf audit ${mode}: ${report.roles} roles, ${report.pairsRequired} legal role pairs, ${report.triplesRequired} legal role triples`,
)
if (mode !== 'smoke') {
  const policies = mode === 'full' ? ['active', 'passive', 'chaos'] : ['active']
  for (const [i, keys] of combinations(2).entries()) {
    let passed = true
    for (const [p, policy] of policies.entries())
      passed =
        run('pair', keys, {
          ...combinationDeck(keys),
          seed: 50001 + i * 13 + p,
          policy,
          faults: mode === 'full' && i % 17 === 0,
        }) && passed
    if (passed) report.pairCombinationsPassed++
  }
}
if (mode === 'full') {
  for (const [i, keys] of combinations(3).entries()) {
    if (
      run('triple', keys, {
        ...combinationDeck(keys),
        seed: 1000001 + i * 7,
        policy: i % 3 === 0 ? 'chaos' : 'active',
        faults: i % 97 === 0,
      })
    )
      report.tripleCombinationsPassed++
  }
}
const games = mode === 'full' ? 5000 : mode === 'ci' ? 200 : 100
for (let i = 0; i < games; i++) {
  const seed = 9000001 + i * 31
  if (
    run('random', [], {
      ...randomDeck(seed, 5 + (i % 20)),
      seed,
      policy: ['active', 'chaos', 'passive'][i % 3],
      faults: i % 7 === 0,
    })
  )
    report.randomGamesPassed++
}
save()
console.log(
  JSON.stringify({
    passed: report.passed,
    failed: report.failed,
    pairs: report.pairCombinationsPassed,
    triples: report.tripleCombinationsPassed,
    random: report.randomGamesPassed,
    resets: report.resetCount,
    disconnects: report.disconnectCount,
    rejections: report.rejectedCount,
    seconds: report.durationSeconds,
    report: fileURLToPath(new URL(`audit-${mode}.json`, directory)),
  }),
)
process.exitCode = report.failed ? 1 : 0
