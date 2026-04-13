<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { useGame } from './useGame'
import { useWerewolfRoom } from './useWerewolfRoom'
import {
  NIGHT_CALL,
  NIGHT_ORDER,
  ROLE_DESC,
  ROLE_EMOJI,
  ROLE_NAMES,
  ROLE_POINTS,
  ROLE_STEP_MAP,
  type NightStep,
  type RoleId,
  type RoleConfig,
  type Faction,
} from './types'

const g = useGame()
const room = useWerewolfRoom()

// ── UI state ──────────────────────────────────────────────────────────────────
const showTimeConfig = ref(false)
const showGuide = ref(false)
const showResetConfirm = ref(false)
const showSpeechSettings = ref(false)
const showPlayersPopover = ref(false)
const showSelfPanel = ref(false)

// Mode selection screen
const modeScreen = ref<'select' | 'create' | 'join' | 'game'>('select')
const joinCode = ref('')
const createName = ref('')
const joinName = ref('')

const viVoices = computed(() => g.availableVoices.value.filter((v) => v.lang.startsWith('vi')))

function handleReset() {
  showResetConfirm.value = false
  g.resetGame()
  if (room.isOnline.value) room.leaveRoom()
  modeScreen.value = 'select'
}

function leaveRoomAndSelectMode() {
  room.leaveRoom()
  modeScreen.value = 'select'
}

function backFromGameSetup() {
  if (room.isOnline.value) room.leaveRoom()
  modeScreen.value = 'select'
}

const STEP_LABELS: Record<NightStep, string> = {
  disruptor: 'Kẻ phá hoại',
  cupid: 'Thần tình yêu',
  wolves: 'Bầy Sói',
  traitor: 'Kẻ phản bội',
  seer: 'Tiên tri',
  guard: 'Bảo vệ',
  witch: 'Phù thủy',
  hunter: 'Thợ săn',
}

const STEP_ICON: Record<NightStep, string> = {
  disruptor: 'lucide:volume-x',
  cupid: 'lucide:heart',
  wolves: 'lucide:moon',
  traitor: 'lucide:user-x',
  seer: 'lucide:eye',
  guard: 'lucide:shield',
  witch: 'lucide:flask-conical',
  hunter: 'lucide:crosshair',
}

const CONFIGURABLE_ROLES: { id: RoleId; faction: 'wolf' | 'villager' }[] = [
  { id: 'wolf', faction: 'wolf' },
  { id: 'wolf-cub', faction: 'wolf' },
  { id: 'cursed-wolf', faction: 'wolf' },
  { id: 'traitor', faction: 'wolf' },
  { id: 'villager', faction: 'villager' },
  { id: 'seer', faction: 'villager' },
  { id: 'guard', faction: 'villager' },
  { id: 'witch', faction: 'villager' },
  { id: 'hunter', faction: 'villager' },
  { id: 'disruptor', faction: 'villager' },
  { id: 'cupid', faction: 'villager' },
]

const WOLF_BITE_ROLES: RoleId[] = ['wolf', 'wolf-cub', 'cursed-wolf']

interface Preset {
  label: string
  config: Partial<RoleConfig>
}

const PRESETS: Preset[] = [
  { label: '4–5 người', config: { wolf: 1, villager: 2, seer: 1, guard: 1 } },
  { label: '6–7 người', config: { wolf: 1, villager: 3, seer: 1, guard: 1 } },
  { label: '8–10 người', config: { wolf: 2, villager: 4, seer: 1, guard: 1 } },
  {
    label: '11–14 người',
    config: { wolf: 3, villager: 5, seer: 1, guard: 1, witch: 1, hunter: 1 },
  },
  {
    label: '15–20 người',
    config: { wolf: 4, villager: 8, seer: 1, guard: 1, witch: 1, hunter: 1, disruptor: 1 },
  },
]

function applyPreset(preset: Preset) {
  for (const key in g.roleConfig.value) {
    ;(g.roleConfig.value as Record<string, number>)[key] = 0
  }
  for (const [role, count] of Object.entries(preset.config)) {
    ;(g.roleConfig.value as Record<string, number>)[role] = count ?? 0
  }
}

const balanceScore = computed(() => {
  let score = 0
  for (const [role, count] of Object.entries(g.roleConfig.value)) {
    score += (ROLE_POINTS[role as RoleId] ?? 0) * count
  }
  return score
})

const onlinePlayers = computed(() => room.roomPlayers.value)
const onlineConnectedPlayers = computed(() =>
  onlinePlayers.value.filter((player) => player.connected),
)
const onlineJoinedPlayerCount = computed(() => onlinePlayers.value.length)
const onlinePlayerCount = computed(() => onlineConnectedPlayers.value.length)

const onlineSetupValid = computed(() => {
  const playerCount = onlinePlayerCount.value
  if (playerCount < 3) return false
  if (g.totalRoles.value !== playerCount) return false
  const wolfCount =
    g.roleConfig.value.wolf + g.roleConfig.value['wolf-cub'] + g.roleConfig.value['cursed-wolf']
  if (wolfCount < 1) return false
  const villagerCount = g.totalRoles.value - wolfCount
  return villagerCount >= 1
})

const currentStepIndex = computed(() => NIGHT_ORDER.indexOf(g.nightStep.value))

const livingBitingWolves = computed(() =>
  g.livingPlayers.value.filter((player) => WOLF_BITE_ROLES.includes(player.role)),
)

const wolvesYetToVote = computed(() => {
  const voted = Object.keys(g.wolfVotes.value)
  return livingBitingWolves.value.filter((wolf) => !voted.includes(wolf.id))
})

const currentWolfVoter = computed(() => wolvesYetToVote.value[0] ?? null)

const wolfVoteTally = computed(() => {
  const tally: Record<string, number> = {}
  for (const targetId of Object.values(g.wolfVotes.value)) {
    tally[targetId] = (tally[targetId] ?? 0) + 1
  }
  return tally
})

const wolfBiteCount = computed(() => (g.wolfCubDiedLastNight.value ? 2 : 1))

const allWolvesVoted = computed(() => {
  return (
    livingBitingWolves.value.length > 0 &&
    livingBitingWolves.value.every((wolf) => Boolean(g.wolfVotes.value[wolf.id]))
  )
})

const witchCanSave = computed(() => !g.witchHealUsed.value && g.witchNightVictim.value !== null)
const witchCanKill = computed(() => !g.witchPoisonUsed.value)
const disconnectedOnlinePlayers = computed(() =>
  room.roomPlayers.value.filter((player) => !player.isHost && !player.connected),
)

const disconnectPauseActive = ref(false)
const pauseWasActiveBeforeDisconnect = ref(false)
const previousRoomConnections = ref<Record<string, boolean>>({})

function getPlayerName(id: string | null | undefined) {
  if (!id) return '—'
  return g.players.value.find((p) => p.id === id)?.name ?? '—'
}

function getPublicPlayerName(id: string) {
  return room.publicPlayers.value.find((p) => p.id === id)?.name ?? 'Người chơi'
}

function isGuardDisabled(playerId: string) {
  return playerId === g.lastGuardTarget.value
}

function getWitchActionExtra() {
  const victim = g.players.value.find((player) => player.id === g.witchNightVictim.value)
  return {
    victimName: victim?.name ?? null,
    canSave: !g.witchHealUsed.value,
    canKill: !g.witchPoisonUsed.value,
  }
}

function requestCurrentTurnForPlayer(playerId: string) {
  if (!room.isOnline.value || !room.isHost.value) return

  if (g.phase.value === 'night' && g.nightUiState.value === 'acting') {
    const roles = ROLE_STEP_MAP[g.nightStep.value]
    if (!roles) return

    const roleList = Array.isArray(roles) ? roles : [roles]
    const player = g.players.value.find((entry) => entry.id === playerId && entry.alive)
    if (!player || !roleList.includes(player.role)) return

    const extra = g.nightStep.value === 'witch' ? getWitchActionExtra() : {}
    room.requestNightAction(playerId, g.nightStep.value, extra)
    return
  }

  if (g.phase.value === 'day-nominate' && g.currentNominatePlayer.value?.id === playerId) {
    room.requestNomination(playerId)
    return
  }

  if (g.phase.value === 'day-hang' && g.currentHangVotePlayer.value?.id === playerId) {
    room.requestHangVote(playerId, g.nominatedPlayers.value)
  }
}

function syncOnlineStateForPlayers(playerIds?: string[]) {
  if (!room.isOnline.value || !room.isHost.value || g.phase.value === 'setup') return

  const targetIds =
    playerIds ??
    room.roomPlayers.value
      .filter((player) => player.connected && !player.isHost)
      .map((player) => player.id)

  for (const targetId of targetIds) {
    const player = g.players.value.find((entry) => entry.id === targetId)
    if (!player) continue
    room.sendRoleToPlayer(targetId, player.role, player.faction)
  }

  room.broadcastPhase(
    g.phase.value,
    g.phase.value === 'night' ? g.nightStep.value : null,
    g.roundNumber.value,
    g.phase.value === 'night' ? g.nightUiState.value : 'calling',
    g.phase.value === 'night' ? g.nightActionTimeLeft.value : 0,
  )
  broadcastPublicPlayers()

  if (g.phase.value === 'day-result') {
    broadcastDayResult()
  }

  if (g.phase.value === 'day-discussion') {
    broadcastDiscussionState()
  }

  if (g.phase.value === 'day-hang') {
    const nominees = g.nominatedPlayers.value
      .map((id) => g.players.value.find((player) => player.id === id)?.name)
      .filter(Boolean) as string[]
    room.broadcastNominated(nominees)
  }

  if (g.phase.value === 'game-over' && g.winnerFaction.value) {
    room.broadcastGameOver(g.winnerFaction.value)
  }

  for (const targetId of targetIds) {
    requestCurrentTurnForPlayer(targetId)
  }
}

function isNightActionAllowed(
  fromPlayerId: string,
  step: NightStep,
  targetId: string,
  payload: Record<string, unknown>,
) {
  if (
    g.phase.value !== 'night' ||
    g.nightUiState.value !== 'acting' ||
    g.nightStep.value !== step
  ) {
    return false
  }

  const actor = g.players.value.find((player) => player.id === fromPlayerId)
  if (!actor || !actor.alive) return false

  const aliveTarget = targetId
    ? (g.players.value.find((player) => player.id === targetId && player.alive) ?? null)
    : null

  switch (step) {
    case 'wolves':
      return (
        WOLF_BITE_ROLES.includes(actor.role) &&
        aliveTarget !== null &&
        aliveTarget.faction !== 'wolf'
      )
    case 'disruptor':
      return actor.role === 'disruptor' && Boolean(aliveTarget) && targetId !== fromPlayerId
    case 'seer':
      return actor.role === 'seer' && Boolean(aliveTarget) && targetId !== fromPlayerId
    case 'guard':
      return actor.role === 'guard' && Boolean(aliveTarget) && !isGuardDisabled(targetId)
    case 'hunter':
      return actor.role === 'hunter' && Boolean(aliveTarget) && targetId !== fromPlayerId
    case 'witch': {
      if (actor.role !== 'witch') return false
      const witchAction = String(payload.witchAction ?? '')
      if (witchAction === 'save') return !g.witchHealUsed.value && Boolean(g.witchNightVictim.value)
      if (witchAction === 'kill') {
        const killTargetId = String(payload.killTargetId ?? '')
        return (
          !g.witchPoisonUsed.value &&
          Boolean(g.players.value.find((player) => player.id === killTargetId && player.alive))
        )
      }
      return witchAction === 'pass'
    }
    case 'cupid': {
      if (actor.role !== 'cupid' || g.roundNumber.value !== 1) return false
      const target1 = String(payload.target1 ?? '')
      const target2 = String(payload.target2 ?? '')
      if (!target1 || !target2 || target1 === target2) return false
      const lover1 = g.players.value.find((player) => player.id === target1 && player.alive)
      const lover2 = g.players.value.find((player) => player.id === target2 && player.alive)
      return Boolean(lover1 && lover2)
    }
    case 'traitor':
      return actor.role === 'traitor'
    default:
      return false
  }
}

function canCurrentPlayerNominate(playerId: string, nomineeId: string | null) {
  if (g.phase.value !== 'day-nominate' || g.currentNominatePlayer.value?.id !== playerId)
    return false
  if (nomineeId === null) return true
  return g.livingPlayers.value.some((player) => player.id === nomineeId && player.id !== playerId)
}

function canCurrentPlayerHangVote(playerId: string, targetId: string | null) {
  if (g.phase.value !== 'day-hang' || g.currentHangVotePlayer.value?.id !== playerId) return false
  if (targetId === null) return true
  return g.nominatedPlayers.value.includes(targetId)
}

function getDeathReasonLabel(reason: string) {
  const map: Record<string, string> = {
    wolf: 'Sói cắn',
    'witch-poison': 'Bình độc',
    'hunter-shot': 'Thợ săn bắn',
    hanged: 'Bị treo cổ',
    'lover-death': 'Chết theo người yêu',
  }
  return map[reason] ?? reason
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function handleCupidClick(playerId: string) {
  if (g.cupidTarget1.value === playerId) {
    g.cupidTarget1.value = null
  } else if (g.cupidTarget2.value === playerId) {
    g.cupidTarget2.value = null
  } else if (!g.cupidTarget1.value) {
    g.setCupidTarget(1, playerId)
  } else if (!g.cupidTarget2.value) {
    g.setCupidTarget(2, playerId)
  }
}

function handleWolfVoteNext() {
  g.wolfVotePlayerIndex.value++
}

// ── Online: skip role reveal phase (roles already sent to phones) ─────────────
function skipToNight() {
  g.skipRoleReveal()
}

// ── Online room management ────────────────────────────────────────────────────

async function doCreateRoom() {
  if (!createName.value.trim()) return
  await room.createRoom(createName.value.trim())
  if (room.status.value === 'waiting') {
    modeScreen.value = 'game'
  }
}

async function doJoinRoom() {
  if (!joinCode.value.trim() || !joinName.value.trim()) return
  await room.joinRoom(joinCode.value.trim(), joinName.value.trim())
  if (room.status.value === 'waiting') {
    modeScreen.value = 'game'
  }
}

async function resumeSavedRoom() {
  await room.resumeSavedSession()
  if (room.mode.value !== 'offline') {
    modeScreen.value = 'game'
  }
}

// ── Host: start online game ───────────────────────────────────────────────────
function startOnlineGame() {
  if (!onlineSetupValid.value) return
  // Online mode: the room creator is also a player and gets a role like everyone else.
  g.players.value = onlineConnectedPlayers.value.map((rp) => ({
    id: rp.id,
    name: rp.name,
    role: 'villager' as RoleId,
    faction: 'villager' as Faction,
    alive: true,
    isSilenced: false,
  }))
  g.startGame()
}

function broadcastPublicPlayers() {
  if (!room.isOnline.value) return
  room.broadcastPlayers(
    g.players.value.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      isSilenced: p.isSilenced,
    })),
  )
}

function broadcastDayResult() {
  if (!room.isOnline.value || !room.isHost.value) return
  room.broadcastDayResult(g.dayDeaths.value, g.currentNightSilenced.value)
}

function broadcastDiscussionState() {
  if (!room.isOnline.value || !room.isHost.value) return
  room.broadcastDiscussionState(
    g.discussionStage.value,
    g.discussionTimeLeft.value,
    g.discussionDecisionTimeLeft.value,
    Object.keys(g.discussionSkipVotes.value).filter(
      (playerId) => g.discussionSkipVotes.value[playerId],
    ),
    { ...g.discussionDecisionVotes.value },
  )
}

// ── Host: watch game state and sync to players ────────────────────────────────

watch(
  () => g.phase.value,
  (newPhase, oldPhase) => {
    if (!room.isOnline.value || !room.isHost.value) return
    if (newPhase === oldPhase) return

    if (newPhase === 'role-reveal' && oldPhase === 'setup') {
      // Send each player their role privately
      for (const player of g.players.value) {
        room.sendRoleToPlayer(player.id, player.role, player.faction)
      }
      broadcastPublicPlayers()
    }

    room.broadcastPhase(
      newPhase,
      newPhase === 'night' ? g.nightStep.value : null,
      g.roundNumber.value,
      newPhase === 'night' ? g.nightUiState.value : 'calling',
      newPhase === 'night' ? g.nightActionTimeLeft.value : 0,
    )
    broadcastPublicPlayers()

    if (newPhase === 'day-result') {
      broadcastDayResult()
    }

    if (newPhase === 'day-discussion') {
      broadcastDiscussionState()
    }

    if (newPhase === 'game-over') {
      room.broadcastGameOver(g.winnerFaction.value as 'wolf' | 'villager')
    }
  },
)

watch(
  () => [g.nightStep.value, g.nightUiState.value] as const,
  ([step, uiState]) => {
    if (!room.isOnline.value || !room.isHost.value) return
    if (g.phase.value !== 'night') return

    room.broadcastPhase(
      'night',
      step,
      g.roundNumber.value,
      g.nightUiState.value,
      g.nightActionTimeLeft.value,
    )

    if (uiState !== 'acting') return

    const roles = ROLE_STEP_MAP[step]
    if (!roles) return
    const roleList = Array.isArray(roles) ? roles : [roles]

    const actingPlayers = g.players.value.filter((p) => p.alive && roleList.includes(p.role))
    for (const ap of actingPlayers) {
      const extra: Record<string, unknown> = step === 'witch' ? getWitchActionExtra() : {}
      room.requestNightAction(ap.id, step, extra)
    }
    if (step === 'traitor') {
      // Traitor just opens eyes — auto-confirm after brief delay
      setTimeout(() => g.confirmTraitor(), 2000)
    }
  },
)

watch(
  () =>
    [g.phase.value, g.nightStep.value, g.nightUiState.value, g.nightActionTimeLeft.value] as const,
  ([phase, step, uiState, actionTimeLeft]) => {
    if (!room.isOnline.value || !room.isHost.value || phase !== 'night') return
    room.broadcastPhase('night', step, g.roundNumber.value, uiState, actionTimeLeft)
  },
)

watch(
  () => [g.phase.value, g.nominateCurrentIndex.value] as const,
  ([phase, idx]) => {
    if (!room.isOnline.value || !room.isHost.value) return
    if (phase !== 'day-nominate') return
    const player = g.livingPlayers.value[idx]
    if (player) room.requestNomination(player.id)
  },
)

watch(
  () => [g.phase.value, g.hangVoteCurrentIndex.value] as const,
  ([phase, idx]) => {
    if (!room.isOnline.value || !room.isHost.value) return
    if (phase !== 'day-hang') return
    const nominees = g.nominatedPlayers.value
      .map((id) => g.players.value.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[]
    room.broadcastNominated(nominees)
    const player = g.livingPlayers.value[idx]
    if (player) room.requestHangVote(player.id, g.nominatedPlayers.value)
  },
)

watch(
  () =>
    [
      g.phase.value,
      g.discussionStage.value,
      g.discussionTimeLeft.value,
      g.discussionDecisionTimeLeft.value,
      JSON.stringify(g.discussionSkipVotes.value),
      JSON.stringify(g.discussionDecisionVotes.value),
    ] as const,
  ([phase]) => {
    if (!room.isOnline.value || !room.isHost.value || phase !== 'day-discussion') return
    broadcastDiscussionState()
  },
)

watch(
  () => room.roomPlayers.value.map((player) => `${player.id}:${player.connected}`).join('|'),
  () => {
    const nextConnections = Object.fromEntries(
      room.roomPlayers.value.map((player) => [player.id, player.connected]),
    ) as Record<string, boolean>
    const previouslyConnected = previousRoomConnections.value

    if (room.isHost.value && room.isOnline.value) {
      const reconnectedPlayerIds = room.roomPlayers.value
        .filter(
          (player) =>
            !player.isHost && player.connected && previouslyConnected[player.id] === false,
        )
        .map((player) => player.id)

      if (
        g.phase.value !== 'setup' &&
        disconnectedOnlinePlayers.value.length > 0 &&
        !disconnectPauseActive.value
      ) {
        disconnectPauseActive.value = true
        pauseWasActiveBeforeDisconnect.value = g.isPaused.value
        if (!g.isPaused.value) {
          g.togglePause()
        }
      }

      if (reconnectedPlayerIds.length > 0) {
        syncOnlineStateForPlayers(reconnectedPlayerIds)
      }

      if (disconnectPauseActive.value && disconnectedOnlinePlayers.value.length === 0) {
        disconnectPauseActive.value = false
        if (!pauseWasActiveBeforeDisconnect.value && g.isPaused.value) {
          g.togglePause()
        }
        pauseWasActiveBeforeDisconnect.value = false
      }
    }

    previousRoomConnections.value = nextConnections
  },
  { deep: true },
)

watch(
  () => g.phase.value,
  (phase) => {
    if (phase === 'setup') {
      disconnectPauseActive.value = false
      pauseWasActiveBeforeDisconnect.value = false
    }
  },
)

// ── Host: process incoming player actions ────────────────────────────────────

watch(
  room.pendingActions,
  (actions) => {
    if (!room.isHost.value) return
    while (actions.length > 0) {
      const item = actions.shift()!
      const { fromPlayerId, action, payload } = item
      const gp = g.players.value.find((p) => p.id === fromPlayerId)
      if (!gp) continue

      if (action === 'ww_night_action') {
        const step = payload.step as NightStep
        const targetId = String(payload.targetId ?? '')
        if (!isNightActionAllowed(fromPlayerId, step, targetId, payload)) continue
        switch (step) {
          case 'disruptor':
            g.setDisruptorTarget(targetId)
            g.confirmDisruptor()
            break
          case 'wolves':
            g.setWolfVote(gp.id, targetId)
            if (wolvesYetToVote.value.filter((w) => w.id !== gp.id).length === 0) {
              setTimeout(() => g.confirmWolfVotes(), 400)
            }
            break
          case 'seer':
            g.setSeerTarget(targetId)
            g.revealSeerResult()
            setTimeout(() => g.confirmSeer(), 1500)
            break
          case 'guard':
            g.setGuardTarget(targetId)
            g.confirmGuard()
            break
          case 'witch': {
            const witchAction = String(payload.witchAction ?? '')
            const killTargetId = String(payload.killTargetId ?? '')
            if (witchAction === 'save') g.witchDoSave()
            if (witchAction === 'kill' && killTargetId) g.witchSetKill(killTargetId)
            g.confirmWitch()
            break
          }
          case 'hunter':
            g.setHunterTarget(targetId)
            g.confirmHunter()
            break
          case 'cupid': {
            const t1 = String(payload.target1 ?? '')
            const t2 = String(payload.target2 ?? '')
            if (t1) g.setCupidTarget(1, t1)
            if (t2) g.setCupidTarget(2, t2)
            g.confirmCupid()
            break
          }
        }
      } else if (action === 'ww_nomination') {
        const nomineeId = (payload.nomineeId as string | null) ?? null
        if (!canCurrentPlayerNominate(fromPlayerId, nomineeId)) continue
        g.castNomination(nomineeId)
        broadcastPublicPlayers()
      } else if (action === 'ww_hang_vote') {
        const votedTargetId = (payload.targetId as string | null) ?? null
        if (!canCurrentPlayerHangVote(fromPlayerId, votedTargetId)) continue
        g.castHangVote(votedTargetId)
        broadcastPublicPlayers()
      } else if (action === 'ww_discussion_skip') {
        if (g.phase.value !== 'day-discussion' || g.discussionStage.value !== 'talking') continue
        if (!g.livingPlayers.value.some((player) => player.id === fromPlayerId)) continue
        g.castDiscussionSkipVote(fromPlayerId)
      } else if (action === 'ww_discussion_decision') {
        const decision = payload.decision
        if (decision !== 'extend' && decision !== 'sleep') continue
        if (g.phase.value !== 'day-discussion' || g.discussionStage.value !== 'decision') continue
        if (!g.livingPlayers.value.some((player) => player.id === fromPlayerId)) continue
        g.castDiscussionDecisionVote(fromPlayerId, decision)
      }
    }
  },
  { deep: true },
)

// ── Player: computed helpers ──────────────────────────────────────────────────

const playerPhaseLabel = computed(() => {
  const p = room.serverPhase.value
  if (p === 'setup') return 'Chờ game bắt đầu...'
  if (p === 'role-reveal') return 'Nhận vai'
  if (p === 'night') return `Đêm ${room.serverRound.value}`
  if (p === 'day-result') return 'Kết quả đêm qua'
  if (p === 'day-discussion') return 'Thảo luận'
  if (p === 'day-nominate') return 'Bỏ phiếu đề cử'
  if (p === 'day-explain') return 'Giải thích'
  if (p === 'day-hang') return 'Bỏ phiếu treo cổ'
  if (p === 'game-over') return 'Kết thúc'
  return ''
})

const playerPhaseStepLabel = computed(() => {
  if (room.serverPhase.value === 'night' && room.serverNightStep.value) {
    return STEP_LABELS[room.serverNightStep.value]
  }
  return playerPhaseLabel.value
})

const myPublicPlayer = computed(
  () => room.publicPlayers.value.find((player) => player.id === room.myPlayerId.value) ?? null,
)

const myRoomPlayer = computed(
  () => room.roomPlayers.value.find((player) => player.id === room.myPlayerId.value) ?? null,
)

const isOnlineAlivePlayer = computed(() => Boolean(myPublicPlayer.value?.alive))

const playerDiscussionSkipSelected = computed(() => {
  if (!room.myPlayerId.value) return false
  return room.serverDiscussionSkipVotes.value.includes(room.myPlayerId.value)
})

const playerDiscussionDecisionSelected = computed(() => {
  if (!room.myPlayerId.value) return null
  return room.serverDiscussionDecisionVotes.value[room.myPlayerId.value] ?? null
})

const playerDiscussionSkipCount = computed(() => room.serverDiscussionSkipVotes.value.length)

const playerDiscussionExtendCount = computed(
  () =>
    Object.values(room.serverDiscussionDecisionVotes.value).filter((vote) => vote === 'extend')
      .length,
)

const playerDiscussionSleepCount = computed(
  () =>
    Object.values(room.serverDiscussionDecisionVotes.value).filter((vote) => vote === 'sleep')
      .length,
)

const onlineAlivePlayerCount = computed(
  () => room.publicPlayers.value.filter((player) => player.alive).length,
)

const isHostOnlineGame = computed(
  () => room.isOnline.value && room.isHost.value && g.phase.value !== 'setup',
)

const currentNightStepLabel = computed(() =>
  room.serverNightStep.value ? STEP_LABELS[room.serverNightStep.value] : 'Đêm',
)

const playerStatusLabel = computed(() => {
  if (room.gameOverWinner.value) return 'Ván đã kết thúc'
  if (room.isMyTurnToAct.value) return 'Đến lượt bạn thao tác'
  if (room.serverPhase.value === 'setup') return 'Đang chờ bắt đầu ván'
  if (myPublicPlayer.value && !myPublicPlayer.value.alive) return 'Bạn đã chết, theo dõi tiếp'
  return 'Đang đồng bộ theo ứng dụng'
})

const playerStatusClass = computed(() => {
  if (room.gameOverWinner.value) return 'border-border-default bg-bg-surface text-text-secondary'
  if (room.isMyTurnToAct.value) return 'border-accent-coral/40 bg-accent-coral/10 text-accent-coral'
  if (myPublicPlayer.value && !myPublicPlayer.value.alive) {
    return 'border-border-default bg-bg-deep text-text-dim'
  }
  if (room.serverPhase.value === 'setup') {
    return 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
  }
  return 'border-accent-sky/30 bg-accent-sky/10 text-accent-sky'
})

const playerSyncHint = computed(() => {
  const phase = room.serverPhase.value
  if (phase === 'setup')
    return 'Chờ máy chính bắt đầu ván. Người tạo phòng vẫn được chia vai như mọi người.'
  if (phase === 'role-reveal')
    return 'Giữ kín vai trò của bạn. Chờ loa đọc để bắt đầu đêm đầu tiên.'
  if (phase === 'night') {
    if (room.isMyTurnToAct.value) return 'Đến lượt bạn thao tác trên điện thoại rồi bấm hoàn thành.'
    return 'Nếu không phải lượt của bạn, hãy nhắm mắt và chờ loa đọc tiếp.'
  }
  if (phase === 'day-result') return 'Theo dõi kết quả đêm và chờ ứng dụng chuyển sang thảo luận.'
  if (phase === 'day-discussion') {
    return room.serverDiscussionStage.value === 'talking'
      ? 'Mọi máy đang cùng ở pha thảo luận ban ngày.'
      : 'Pha thảo luận đã kết thúc, mọi người đang quyết định thêm giờ hay đi ngủ.'
  }
  if (phase === 'day-nominate') {
    if (room.myActionExtra.value?.type === 'nomination') return 'Đến lượt bạn đề cử một người chơi.'
    return 'Chờ đến lượt đề cử của bạn trên điện thoại.'
  }
  if (phase === 'day-explain') return 'Người bị đề cử đang giải thích trên màn hình chính.'
  if (phase === 'day-hang') {
    if (room.myActionExtra.value?.type === 'hang_vote') return 'Đến lượt bạn bỏ phiếu treo cổ.'
    return 'Chờ đến lượt bỏ phiếu của bạn trên điện thoại.'
  }
  if (phase === 'game-over') return 'Ván chơi đã kết thúc.'
  return ''
})

// General selection ref (reused for night actions, nominations, hang votes)
const selectedTarget = ref<string | null>(null)
// For witch player action
const witchChoice = ref<'none' | 'save' | 'kill'>('none')
const witchKillTarget = ref<string | null>(null)
// For offline witch: show kill target list
const showWitchKillTargets = ref(false)

// For cupid player action
const cupidChoice1 = ref<string | null>(null)
const cupidChoice2 = ref<string | null>(null)
const playerSubmittedState = ref<{
  phase: string
  step: string | null
  message: string
} | null>(null)

const playerActionType = computed(() => String(room.myActionExtra.value.type ?? ''))

const playerTurnInstruction = computed(() => {
  if (!room.isMyTurnToAct.value) return null

  if (room.serverPhase.value === 'night' && room.myActionStep.value) {
    const step = room.myActionStep.value
    const detailMap: Partial<Record<NightStep, string>> = {
      disruptor: 'Chọn một người để cấm nói trong ngày mai rồi bấm xác nhận.',
      cupid: 'Chọn đúng 2 người chơi để ghép đôi rồi bấm xác nhận.',
      wolves: 'Phe Sói mở mắt và chọn mục tiêu muốn cắn trong đêm nay.',
      seer: 'Chọn một người để soi, kết quả sẽ được ứng dụng xử lý tự động.',
      guard: 'Chọn một người để bảo vệ trong đêm nay.',
      witch: 'Quyết định cứu nạn nhân, dùng độc hoặc bỏ qua lượt của bạn.',
      hunter: 'Chọn một người để bắn rồi bấm xác nhận.',
    }

    return {
      icon: STEP_ICON[step],
      title: NIGHT_CALL[step],
      detail: detailMap[step] ?? 'Hãy thao tác trên máy này rồi bấm xác nhận.',
      tone: 'danger' as const,
    }
  }

  if (playerActionType.value === 'nomination') {
    return {
      icon: 'lucide:vote',
      title: 'Đến lượt bạn đề cử',
      detail: 'Chọn một người chơi hoặc bỏ qua nếu bạn chưa muốn đề cử ai.',
      tone: 'warning' as const,
    }
  }

  if (playerActionType.value === 'hang_vote') {
    return {
      icon: 'lucide:scale',
      title: 'Đến lượt bạn bỏ phiếu',
      detail: 'Chọn một người trong danh sách bị đề cử hoặc bỏ phiếu trắng.',
      tone: 'danger' as const,
    }
  }

  return null
})

const playerSubmittedMessage = computed(() => {
  const submitted = playerSubmittedState.value
  if (!submitted || room.isMyTurnToAct.value) return null

  const currentStep =
    room.serverPhase.value === 'night'
      ? room.serverNightStep.value
      : room.serverPhase.value === 'day-discussion'
        ? room.serverDiscussionStage.value === 'talking'
          ? 'discussion-skip'
          : 'discussion-decision'
        : playerActionType.value || null

  if (submitted.phase !== room.serverPhase.value || submitted.step !== currentStep) {
    return null
  }

  return submitted.message
})

const playerWaitingState = computed(() => {
  if (playerSubmittedMessage.value) {
    return {
      icon: 'lucide:check-check',
      title: 'Đã gửi thao tác',
      detail: `${playerSubmittedMessage.value} Nhắm mắt và chờ loa đọc tới lượt tiếp theo.`,
    }
  }

  if (room.serverPhase.value === 'night') {
    return {
      icon: 'lucide:moon-star',
      title: room.serverNightStep.value ? STEP_LABELS[room.serverNightStep.value] : 'Đêm xuống',
      detail: 'Nếu không phải lượt của bạn, hãy giữ im lặng và nhắm mắt chờ tiếp.',
    }
  }

  return {
    icon: 'lucide:clock-3',
    title: playerPhaseStepLabel.value,
    detail: playerSyncHint.value,
  }
})

watch(
  () => room.isMyTurnToAct.value,
  (isTurn) => {
    if (isTurn && room.isHost.value) {
      showSelfPanel.value = true
    }
  },
)

function rememberPlayerSubmission(message: string, step: string | null) {
  playerSubmittedState.value = {
    phase: room.serverPhase.value,
    step,
    message,
  }
}

watch(
  () =>
    [
      room.serverPhase.value,
      room.serverNightStep.value,
      room.serverDiscussionStage.value,
      playerActionType.value,
    ] as const,
  () => {
    selectedTarget.value = null
    witchChoice.value = 'none'
    witchKillTarget.value = null
    cupidChoice1.value = null
    cupidChoice2.value = null
    playerSubmittedState.value = null
  },
)

watch(
  () => room.isMyTurnToAct.value,
  (isTurn) => {
    if (isTurn) {
      playerSubmittedState.value = null
    }
  },
)

function selectActionTarget(playerId: string) {
  selectedTarget.value = selectedTarget.value === playerId ? null : playerId
}

function selectWitchKillTarget(playerId: string) {
  witchKillTarget.value = witchKillTarget.value === playerId ? null : playerId
}

function toggleOfflineWitchKillTargets() {
  showWitchKillTargets.value = !showWitchKillTargets.value
  if (!showWitchKillTargets.value) g.witchSetKill(null)
}

function confirmOfflineWitch() {
  showWitchKillTargets.value = false
  g.confirmWitch()
}

function submitSingleTargetNightAction() {
  const step = room.myActionStep.value
  const targetId = selectedTarget.value
  if (!step || !targetId) return
  rememberPlayerSubmission(`Bạn đã chọn ${getPublicPlayerName(targetId)}.`, step)
  room.submitNightAction(step, targetId)
  selectedTarget.value = null
}

function submitCupidAction() {
  if (!cupidChoice1.value || !cupidChoice2.value) return
  rememberPlayerSubmission(
    `Bạn đã ghép ${getPublicPlayerName(cupidChoice1.value)} và ${getPublicPlayerName(cupidChoice2.value)}.`,
    'cupid',
  )
  room.submitNightAction('cupid', '', {
    step: 'cupid',
    target1: cupidChoice1.value,
    target2: cupidChoice2.value,
  })
  cupidChoice1.value = null
  cupidChoice2.value = null
}

function submitWitchAction() {
  if (witchChoice.value === 'save') {
    rememberPlayerSubmission('Bạn đã chọn cứu nạn nhân của đêm nay.', 'witch')
    room.submitNightAction('witch', '', { step: 'witch', witchAction: 'save' })
  } else if (witchChoice.value === 'kill' && witchKillTarget.value) {
    rememberPlayerSubmission(
      `Bạn đã dùng độc lên ${getPublicPlayerName(witchKillTarget.value)}.`,
      'witch',
    )
    room.submitNightAction('witch', '', {
      step: 'witch',
      witchAction: 'kill',
      killTargetId: witchKillTarget.value,
    })
  } else {
    rememberPlayerSubmission('Bạn đã bỏ qua lượt phù thủy.', 'witch')
    room.submitNightAction('witch', '', { step: 'witch', witchAction: 'pass' })
  }
  witchChoice.value = 'none'
  witchKillTarget.value = null
}

function skipNomination() {
  rememberPlayerSubmission('Bạn đã bỏ qua lượt đề cử.', 'nomination')
  room.submitNomination(null)
  selectedTarget.value = null
}

function submitNomination() {
  if (selectedTarget.value) {
    rememberPlayerSubmission(
      `Bạn đã đề cử ${getPublicPlayerName(selectedTarget.value)}.`,
      'nomination',
    )
  }
  room.submitNomination(selectedTarget.value)
  selectedTarget.value = null
}

function skipHangVote() {
  rememberPlayerSubmission('Bạn đã bỏ phiếu trắng.', 'hang_vote')
  room.submitHangVote(null)
  selectedTarget.value = null
}

function submitHangVote() {
  if (selectedTarget.value) {
    rememberPlayerSubmission(
      `Bạn đã bỏ phiếu cho ${getPublicPlayerName(selectedTarget.value)}.`,
      'hang_vote',
    )
  }
  room.submitHangVote(selectedTarget.value)
  selectedTarget.value = null
}

function submitDiscussionSkipVote() {
  if (room.isHost.value) {
    if (
      !room.myPlayerId.value ||
      !g.livingPlayers.value.some((player) => player.id === room.myPlayerId.value)
    ) {
      return
    }
  } else if (!isOnlineAlivePlayer.value) {
    return
  }

  rememberPlayerSubmission('Bạn đã chọn bỏ qua phần thảo luận.', 'discussion-skip')
  if (room.isHost.value && room.myPlayerId.value) {
    g.castDiscussionSkipVote(room.myPlayerId.value)
    return
  }

  room.submitDiscussionSkip()
}

function submitDiscussionDecision(decision: 'extend' | 'sleep') {
  if (room.isHost.value) {
    if (
      !room.myPlayerId.value ||
      !g.livingPlayers.value.some((player) => player.id === room.myPlayerId.value)
    ) {
      return
    }
  } else if (!isOnlineAlivePlayer.value) {
    return
  }

  rememberPlayerSubmission(
    decision === 'extend' ? 'Bạn đã chọn thêm thời gian thảo luận.' : 'Bạn đã chọn đi ngủ.',
    'discussion-decision',
  )

  if (room.isHost.value && room.myPlayerId.value) {
    g.castDiscussionDecisionVote(room.myPlayerId.value, decision)
    return
  }

  room.submitDiscussionDecision(decision)
}

function handleCupidPlayerClick(playerId: string) {
  if (cupidChoice1.value === playerId) cupidChoice1.value = null
  else if (cupidChoice2.value === playerId) cupidChoice2.value = null
  else if (!cupidChoice1.value) cupidChoice1.value = playerId
  else if (!cupidChoice2.value) cupidChoice2.value = playerId
}

function updateTimeConfig(key: string, value: string) {
  const config = g.timeConfig.value as Record<string, number>
  config[key] = Number(value)
}
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary">
    <!-- ══════════════════════ MODE SELECT (initial screen) ══ -->
    <div
      v-if="room.mode.value === 'offline' && modeScreen === 'select'"
      class="flex min-h-screen flex-col items-center justify-center px-4"
    >
      <div class="w-full max-w-sm">
        <RouterLink
          to="/"
          class="mb-8 flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary w-fit transition hover:border-accent-coral hover:text-accent-coral"
        >
          <Icon icon="lucide:arrow-left" class="size-3.5" />
          Trang chủ
        </RouterLink>

        <div class="mb-2 text-4xl">🐺</div>
        <h1 class="mb-1 font-display text-3xl font-bold">Ma Sói Tự Dẫn</h1>
        <p class="mb-8 text-sm text-text-secondary">Chọn chế độ chơi</p>

        <!-- Offline mode -->
        <button
          class="mb-3 w-full border border-accent-coral bg-accent-coral/10 py-4 font-display text-lg font-bold text-accent-coral transition hover:bg-accent-coral/20"
          @click="modeScreen = 'game'"
        >
          <Icon icon="lucide:monitor" class="mr-2 inline size-5" />
          Chơi offline (1 máy)
        </button>
        <p class="mb-6 text-center text-xs text-text-dim">Mọi người dùng chung 1 điện thoại</p>

        <!-- Create room -->
        <div v-if="modeScreen === 'select'" class="space-y-3">
          <button
            v-if="room.savedSession.value"
            class="w-full border border-border-default bg-bg-surface py-4 font-display text-lg font-bold text-text-primary transition hover:border-accent-amber hover:text-accent-amber"
            @click="resumeSavedRoom"
          >
            <Icon icon="lucide:history" class="mr-2 inline size-5" />
            Quay lại phòng đang chơi
          </button>
          <button
            class="w-full border border-accent-amber bg-accent-amber/10 py-4 font-display text-lg font-bold text-accent-amber transition hover:bg-accent-amber/20"
            @click="modeScreen = 'create'"
          >
            <Icon icon="lucide:plus-circle" class="mr-2 inline size-5" />
            Tạo phòng (máy chính)
          </button>
          <button
            class="w-full border border-accent-sky bg-accent-sky/10 py-4 font-display text-lg font-bold text-accent-sky transition hover:bg-accent-sky/20"
            @click="modeScreen = 'join'"
          >
            <Icon icon="lucide:log-in" class="mr-2 inline size-5" />
            Vào phòng (người chơi)
          </button>
          <p class="text-center text-xs text-text-dim">
            {{
              room.savedSession.value
                ? `Phiên gần nhất: phòng ${room.savedSession.value.roomId} - ${room.savedSession.value.displayName}`
                : 'Mỗi người dùng điện thoại riêng'
            }}
          </p>
        </div>
      </div>
    </div>

    <!-- ══════════════════════ CREATE ROOM SCREEN ══ -->
    <div
      v-else-if="room.mode.value === 'offline' && modeScreen === 'create'"
      class="flex min-h-screen flex-col items-center justify-center px-4"
    >
      <div class="w-full max-w-sm">
        <div class="mb-6 flex items-center justify-between gap-3">
          <button
            class="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-coral"
            @click="modeScreen = 'select'"
          >
            <Icon icon="lucide:arrow-left" class="size-3.5" /> Quay lại
          </button>
          <div class="flex gap-2">
            <button
              class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
              @click="showGuide = true"
            >
              <Icon icon="lucide:book-open" class="size-3.5" /> Hướng dẫn
            </button>
            <button
              class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
              @click="showSpeechSettings = true"
            >
              <Icon icon="lucide:settings-2" class="size-3.5" /> Giọng đọc
            </button>
          </div>
        </div>
        <h2 class="mb-6 font-display text-2xl font-bold">Tạo phòng</h2>
        <label class="mb-1 block text-xs text-text-dim">Tên của bạn</label>
        <input
          v-model="createName"
          type="text"
          placeholder="Nhập tên của bạn..."
          class="mb-4 w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-dim focus:border-accent-coral focus:outline-none"
          @keyup.enter="doCreateRoom"
        />
        <p v-if="room.errorMsg.value" class="mb-3 text-xs text-accent-coral">
          {{ room.errorMsg.value }}
        </p>
        <button
          class="w-full border border-accent-amber bg-accent-amber/10 py-4 font-display text-lg font-bold text-accent-amber transition hover:bg-accent-amber/20 disabled:opacity-50"
          :disabled="!createName.trim() || room.status.value === 'creating'"
          @click="doCreateRoom"
        >
          <span v-if="room.status.value === 'creating'">Đang tạo...</span>
          <span v-else>Tạo phòng</span>
        </button>
      </div>
    </div>

    <!-- ══════════════════════ JOIN ROOM SCREEN ══ -->
    <div
      v-else-if="room.mode.value === 'offline' && modeScreen === 'join'"
      class="flex min-h-screen flex-col items-center justify-center px-4"
    >
      <div class="w-full max-w-sm">
        <button
          class="mb-6 flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-coral"
          @click="modeScreen = 'select'"
        >
          <Icon icon="lucide:arrow-left" class="size-3.5" /> Quay lại
        </button>
        <h2 class="mb-6 font-display text-2xl font-bold">Vào phòng</h2>
        <label class="mb-1 block text-xs text-text-dim">Tên của bạn</label>
        <input
          v-model="joinName"
          type="text"
          placeholder="Nhập tên..."
          class="mb-3 w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-dim focus:border-accent-sky focus:outline-none"
        />
        <label class="mb-1 block text-xs text-text-dim">Mã phòng</label>
        <input
          v-model="joinCode"
          type="text"
          placeholder="Nhập mã phòng..."
          class="mb-4 w-full border border-border-default bg-bg-surface px-3 py-2.5 font-display text-sm uppercase tracking-widest text-text-primary placeholder-text-dim focus:border-accent-sky focus:outline-none"
          @keyup.enter="doJoinRoom"
        />
        <p v-if="room.errorMsg.value" class="mb-3 text-xs text-accent-coral">
          {{ room.errorMsg.value }}
        </p>
        <button
          class="w-full border border-accent-sky bg-accent-sky/10 py-4 font-display text-lg font-bold text-accent-sky transition hover:bg-accent-sky/20 disabled:opacity-50"
          :disabled="!joinName.trim() || !joinCode.trim() || room.status.value === 'joining'"
          @click="doJoinRoom"
        >
          <span v-if="room.status.value === 'joining'">Đang vào...</span>
          <span v-else>Vào phòng</span>
        </button>
      </div>
    </div>

    <!-- ══════════════════════ HOST WAITING LOBBY ══ -->
    <div
      v-else-if="
        room.mode.value === 'host' && room.status.value === 'waiting' && g.phase.value === 'setup'
      "
      class="mx-auto max-w-lg px-4 py-8"
    >
      <div class="mb-6 flex items-center justify-between">
        <button
          class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
          @click="leaveRoomAndSelectMode"
        >
          <Icon icon="lucide:arrow-left" class="size-3.5" /> Thoát
        </button>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
            @click="showGuide = true"
          >
            <Icon icon="lucide:book-open" class="size-3.5" /> Hướng dẫn
          </button>
          <button
            class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
            @click="showSpeechSettings = true"
          >
            <Icon icon="lucide:settings-2" class="size-3.5" /> Giọng đọc
          </button>
          <span class="font-display text-xs text-text-dim">PHÒNG ONLINE</span>
        </div>
      </div>

      <h1 class="mb-1 font-display text-2xl font-bold">Phòng của bạn</h1>

      <!-- Room code -->
      <div class="mb-6 border border-accent-amber bg-accent-amber/10 p-4">
        <p class="mb-1 text-xs text-text-dim">Mã phòng — chia sẻ cho người chơi</p>
        <p class="font-display text-3xl font-bold tracking-[0.25em] text-accent-amber">
          {{ room.roomId.value }}
        </p>
        <p class="mt-1 text-xs text-text-dim">Người chơi vào app → "Vào phòng" → nhập mã trên</p>
      </div>

      <div class="mb-6 border border-accent-sky/20 bg-bg-surface p-4">
        <p class="font-display text-xs tracking-widest text-accent-sky uppercase">Đồng bộ online</p>
        <p class="mt-2 text-sm text-text-secondary">
          Ứng dụng tự dẫn toàn bộ nhịp game và đọc loa trên máy chính. Người tạo phòng vẫn là một
          người chơi, chỉ khác là máy đó phát loa và đồng bộ tiến trình cho cả phòng.
        </p>
      </div>

      <!-- Player list -->
      <div class="mb-6">
        <p class="mb-3 font-display text-xs tracking-widest text-text-dim uppercase">
          <span class="text-accent-coral">//</span> Người chơi
          <span class="ml-2 text-accent-amber"
            >({{ onlinePlayerCount }}/{{ onlineJoinedPlayerCount }})</span
          >
        </p>
        <div class="space-y-2">
          <div
            v-for="p in onlinePlayers"
            :key="p.id"
            class="flex items-center justify-between border border-border-default bg-bg-surface px-4 py-2.5"
          >
            <div class="flex items-center gap-2">
              <span
                class="size-2 rounded-full"
                :class="p.connected ? 'bg-accent-sky' : 'bg-border-default'"
              />
              <span class="text-sm">{{ p.name }}</span>
              <span v-if="p.isHost" class="text-xs text-accent-amber">(máy chính)</span>
            </div>
            <span class="text-xs text-text-dim">{{ p.connected ? 'Đã vào' : 'Chưa kết nối' }}</span>
          </div>
          <p v-if="onlinePlayers.length === 0" class="text-sm text-text-dim">
            Chưa có người vào...
          </p>
        </div>
      </div>

      <!-- Role configuration -->
      <div class="mb-6">
        <p class="mb-3 font-display text-xs tracking-widest text-text-dim uppercase">
          <span class="text-accent-amber">//</span> Vai trò
          <span
            class="ml-2"
            :class="
              g.totalRoles.value === onlinePlayerCount ? 'text-accent-sky' : 'text-accent-coral'
            "
          >
            {{ g.totalRoles.value }}/{{ onlinePlayerCount }}
          </span>
        </p>

        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="preset in PRESETS"
            :key="preset.label"
            class="border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <p class="mb-2 font-display text-xs text-accent-coral">Phe Sói</p>
        <div class="mb-4 space-y-2">
          <div
            v-for="r in CONFIGURABLE_ROLES.filter((x) => x.faction === 'wolf')"
            :key="r.id"
            class="flex items-center justify-between border border-border-default bg-bg-surface px-4 py-3"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-base">{{ ROLE_EMOJI[r.id] }}</span>
                <span class="font-display text-sm font-semibold">{{ ROLE_NAMES[r.id] }}</span>
                <span
                  class="ml-2 font-display text-xs font-bold"
                  :class="ROLE_POINTS[r.id] < 0 ? 'text-accent-coral' : 'text-accent-sky'"
                >
                  {{ ROLE_POINTS[r.id] > 0 ? '+' : '' }}{{ ROLE_POINTS[r.id] }}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-text-dim">{{ ROLE_DESC[r.id] }}</p>
            </div>
            <div class="ml-4 flex items-center gap-2">
              <button
                class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-coral hover:text-accent-coral"
                @click="g.setRoleCount(r.id, -1)"
              >
                <Icon icon="lucide:minus" class="size-3.5" />
              </button>
              <span class="w-5 text-center font-display font-bold text-text-primary">{{
                g.roleConfig.value[r.id]
              }}</span>
              <button
                class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-coral hover:text-accent-coral"
                @click="g.setRoleCount(r.id, 1)"
              >
                <Icon icon="lucide:plus" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <p class="mb-2 font-display text-xs text-accent-sky">Phe Dân</p>
        <div class="space-y-2">
          <div
            v-for="r in CONFIGURABLE_ROLES.filter((x) => x.faction === 'villager')"
            :key="r.id"
            class="flex items-center justify-between border border-border-default bg-bg-surface px-4 py-3"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-base">{{ ROLE_EMOJI[r.id] }}</span>
                <span class="font-display text-sm font-semibold">{{ ROLE_NAMES[r.id] }}</span>
                <span
                  class="ml-2 font-display text-xs font-bold"
                  :class="ROLE_POINTS[r.id] < 0 ? 'text-accent-coral' : 'text-accent-sky'"
                >
                  {{ ROLE_POINTS[r.id] > 0 ? '+' : '' }}{{ ROLE_POINTS[r.id] }}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-text-dim">{{ ROLE_DESC[r.id] }}</p>
            </div>
            <div class="ml-4 flex items-center gap-2">
              <button
                class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-sky hover:text-accent-sky"
                @click="g.setRoleCount(r.id, -1)"
              >
                <Icon icon="lucide:minus" class="size-3.5" />
              </button>
              <span class="w-5 text-center font-display font-bold text-text-primary">{{
                g.roleConfig.value[r.id]
              }}</span>
              <button
                class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-sky hover:text-accent-sky"
                @click="g.setRoleCount(r.id, 1)"
              >
                <Icon icon="lucide:plus" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div class="mt-4 border border-border-default bg-bg-surface px-4 py-3">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-dim">Điểm cân bằng</span>
            <span
              class="font-display text-sm font-bold"
              :class="
                Math.abs(balanceScore) <= 3
                  ? 'text-accent-sky'
                  : balanceScore < 0
                    ? 'text-accent-coral'
                    : 'text-accent-amber'
              "
            >
              {{ balanceScore > 0 ? '+' : '' }}{{ balanceScore }}
              <span class="ml-1 text-xs font-normal text-text-dim">{{
                Math.abs(balanceScore) <= 3
                  ? '(cân bằng)'
                  : balanceScore < 0
                    ? '(nghiêng về Sói)'
                    : '(nghiêng về Dân)'
              }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Start button -->
      <button
        class="w-full border py-4 font-display text-lg font-bold tracking-wide transition"
        :class="
          onlineSetupValid
            ? 'border-accent-coral bg-accent-coral/10 text-accent-coral hover:bg-accent-coral/20'
            : 'cursor-not-allowed border-border-default text-text-dim'
        "
        :disabled="!onlineSetupValid"
        @click="startOnlineGame"
      >
        Bắt đầu game
      </button>
      <p class="mt-2 text-center text-xs text-text-dim">
        <span v-if="onlinePlayerCount < 3">Cần ít nhất 3 người chơi kết nối. </span>
        <span v-else-if="g.totalRoles.value !== onlinePlayerCount">
          Tổng vai ({{ g.totalRoles.value }}) phải bằng số người chơi ({{ onlinePlayerCount }}).
        </span>
        <span v-else>Máy tạo phòng vẫn là một người chơi và được chia vai như mọi người.</span>
      </p>
    </div>

    <!-- ══════════════════════════ PLAYER VIEW ══ -->
    <div v-else-if="room.mode.value === 'player'" class="min-h-screen">
      <!-- Player waiting lobby -->
      <div
        v-if="
          room.status.value === 'waiting' &&
          !room.myRole.value &&
          room.serverPhase.value === 'setup'
        "
        class="mx-auto max-w-sm px-4 py-6"
      >
        <div class="mb-4 flex items-center justify-between">
          <button
            class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
            @click="leaveRoomAndSelectMode"
          >
            <Icon icon="lucide:arrow-left" class="size-3.5" /> Thoát phòng
          </button>
          <div class="flex items-center gap-2">
            <button
              class="flex size-9 items-center justify-center border border-border-default bg-bg-surface text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
              @click="showPlayersPopover = true"
            >
              <Icon icon="lucide:users" class="size-4" />
            </button>
            <span class="font-display text-xs text-text-dim">NGƯỜI CHƠI ONLINE</span>
          </div>
        </div>

        <div class="mb-4 border border-border-default bg-bg-surface p-4">
          <p class="mb-1 text-xs text-text-dim">Phòng</p>
          <p class="font-display text-2xl font-bold tracking-[0.2em] text-accent-amber">
            {{ room.roomId.value }}
          </p>
          <p class="mt-2 text-sm text-text-secondary">
            Chờ máy chính bắt đầu ván và phát loa đọc để vào đêm đầu tiên.
          </p>
        </div>

        <div class="mb-4 grid grid-cols-2 gap-2">
          <div class="border border-border-default bg-bg-surface p-3">
            <p class="text-[11px] tracking-widest text-text-dim uppercase">Pha hiện tại</p>
            <p class="mt-1 font-display text-sm font-semibold text-text-primary">
              {{ playerPhaseLabel }}
            </p>
          </div>
          <div class="border border-accent-amber/30 bg-accent-amber/10 p-3">
            <p class="text-[11px] tracking-widest text-text-dim uppercase">Thiết bị</p>
            <p class="mt-1 font-display text-sm font-semibold text-accent-amber">
              {{ playerStatusLabel }}
            </p>
          </div>
        </div>

        <div class="border border-border-default bg-bg-surface p-4">
          <div class="mb-3 flex items-center justify-between">
            <p class="font-display text-xs tracking-widest text-text-dim uppercase">Người chơi</p>
            <span class="text-xs text-accent-amber"
              >{{ onlinePlayerCount }}/{{ onlineJoinedPlayerCount }}</span
            >
          </div>
          <div class="space-y-2">
            <div
              v-for="p in onlinePlayers"
              :key="p.id"
              class="flex items-center gap-2 border border-border-default bg-bg-elevated px-4 py-2"
            >
              <span
                class="size-2 rounded-full"
                :class="p.connected ? 'bg-accent-sky' : 'bg-border-default'"
              />
              <span class="text-sm">{{ p.name }}</span>
              <span v-if="p.isHost" class="text-xs text-accent-amber">(máy chính)</span>
              <span v-if="p.id === room.myPlayerId.value" class="ml-auto text-xs text-accent-coral"
                >(bạn)</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Player game view -->
      <div
        v-else-if="room.status.value === 'playing' || room.myRole.value"
        class="mx-auto max-w-sm px-4 py-6"
      >
        <!-- Header: synchronized phase + role badge -->
        <div class="mb-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="font-display text-xs tracking-widest text-text-dim uppercase">
              {{ playerPhaseLabel }}
            </span>
            <div class="flex items-center gap-2">
              <button
                class="flex size-9 items-center justify-center border border-border-default bg-bg-surface text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
                @click="showPlayersPopover = true"
              >
                <Icon icon="lucide:users" class="size-4" />
              </button>
              <span class="text-xs text-text-dim">Phòng {{ room.roomId.value }}</span>
            </div>
          </div>
          <div
            v-if="room.myRole.value"
            class="border px-3 py-1 font-display text-xs font-bold"
            :class="
              room.myFaction.value === 'wolf'
                ? 'border-accent-coral/50 text-accent-coral bg-accent-coral/10'
                : 'border-accent-sky/50 text-accent-sky bg-accent-sky/10'
            "
          >
            {{ ROLE_EMOJI[room.myRole.value] }} {{ ROLE_NAMES[room.myRole.value] }}
          </div>
        </div>

        <div class="mb-4 grid grid-cols-2 gap-2">
          <div class="border border-border-default bg-bg-surface p-3">
            <p class="text-[11px] tracking-widest text-text-dim uppercase">Trạng thái</p>
            <div
              class="mt-2 inline-flex border px-2.5 py-1 text-xs font-semibold"
              :class="playerStatusClass"
            >
              {{ playerStatusLabel }}
            </div>
          </div>
          <div class="border border-border-default bg-bg-surface p-3">
            <p class="text-[11px] tracking-widest text-text-dim uppercase">
              {{ room.publicPlayers.value.length > 0 ? 'Người còn sống' : 'Vòng hiện tại' }}
            </p>
            <p class="mt-1 font-display text-sm font-semibold text-text-primary">
              {{
                room.publicPlayers.value.length > 0
                  ? `${onlineAlivePlayerCount}/${room.publicPlayers.value.length}`
                  : `Đêm ${room.serverRound.value}`
              }}
            </p>
          </div>
        </div>

        <div class="mb-4 border border-accent-amber/20 bg-bg-surface/90 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-accent-amber">
            <Icon
              :icon="
                room.serverPhase.value === 'night' && room.serverNightStep.value
                  ? STEP_ICON[room.serverNightStep.value]
                  : 'lucide:radio'
              "
              class="size-4"
            />
            <span>{{ playerPhaseStepLabel }}</span>
          </div>
          <p class="mt-2 text-sm text-text-secondary">{{ playerSyncHint }}</p>
        </div>

        <!-- Role reveal card (persistent) -->
        <div
          v-if="room.myRole.value"
          class="mb-4 border p-4"
          :class="
            room.myFaction.value === 'wolf'
              ? 'border-accent-coral/30 bg-accent-coral/5'
              : 'border-accent-sky/30 bg-accent-sky/5'
          "
        >
          <div class="flex items-center gap-3">
            <span class="text-3xl">{{ ROLE_EMOJI[room.myRole.value] }}</span>
            <div>
              <p class="font-display text-lg font-bold">{{ ROLE_NAMES[room.myRole.value] }}</p>
              <p
                class="text-xs font-semibold"
                :class="room.myFaction.value === 'wolf' ? 'text-accent-coral' : 'text-accent-sky'"
              >
                {{ room.myFaction.value === 'wolf' ? 'Phe Sói 🐺' : 'Phe Dân 👥' }}
              </p>
              <p class="mt-1 text-xs text-text-dim">{{ ROLE_DESC[room.myRole.value] }}</p>
            </div>
          </div>
        </div>

        <div
          v-if="
            room.nominatedNames.value.length > 0 &&
            ['day-explain', 'day-hang'].includes(room.serverPhase.value)
          "
          class="mb-4 border border-accent-amber/20 bg-bg-surface p-4"
        >
          <p class="mb-2 text-xs tracking-widest text-text-dim uppercase">Đang bị đề cử</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="name in room.nominatedNames.value"
              :key="name"
              class="border border-accent-amber/30 bg-accent-amber/10 px-3 py-1 text-sm text-accent-amber"
            >
              {{ name }}
            </span>
          </div>
        </div>

        <div
          v-if="room.serverPhase.value === 'day-result'"
          class="mb-4 border border-accent-amber/20 bg-bg-surface p-4"
        >
          <p class="mb-3 font-display text-sm font-semibold text-accent-amber">Kết quả đêm qua</p>
          <div
            v-if="room.serverDayDeaths.value.length === 0"
            class="border border-accent-sky/20 bg-accent-sky/10 p-3 text-sm text-text-secondary"
          >
            Đêm qua bình yên. Không ai chết.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="death in room.serverDayDeaths.value"
              :key="`${death.playerId}-${death.reason}`"
              class="flex items-center justify-between border border-accent-coral/20 bg-accent-coral/5 px-3 py-2 text-sm"
            >
              <span class="font-semibold text-text-primary">
                {{ getPublicPlayerName(death.playerId) }}
              </span>
              <span class="text-xs text-text-dim">{{ getDeathReasonLabel(death.reason) }}</span>
            </div>
          </div>
          <div
            v-if="room.serverNightSilenced.value"
            class="mt-3 border border-accent-amber/20 bg-accent-amber/10 px-3 py-2 text-sm text-text-secondary"
          >
            <span class="font-semibold text-text-primary">
              {{ getPublicPlayerName(room.serverNightSilenced.value) }}
            </span>
            bị cấm thảo luận hôm nay.
          </div>
        </div>

        <div
          v-if="
            room.serverPhase.value === 'night' &&
            room.serverNightStep.value &&
            room.serverNightUiState.value === 'acting'
          "
          class="mb-4 border border-accent-coral/20 bg-bg-surface p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.24em] text-text-dim">Vai đang thao tác</p>
              <p class="mt-1 font-display text-lg font-bold text-text-primary">
                {{ currentNightStepLabel }}
              </p>
            </div>
            <div class="border border-accent-coral/30 bg-accent-coral/10 px-3 py-2 text-right">
              <p class="text-[10px] uppercase tracking-[0.24em] text-text-dim">Đếm ngược</p>
              <p class="font-display text-lg font-bold text-accent-coral">
                {{ formatTime(room.serverNightActionTimeLeft.value) }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="playerSubmittedMessage"
          class="mb-4 border border-accent-sky/30 bg-accent-sky/10 p-4"
        >
          <div class="flex items-center gap-2 text-sm font-semibold text-accent-sky">
            <Icon icon="lucide:check-check" class="size-4" />
            <span>Đã gửi thao tác</span>
          </div>
          <p class="mt-2 text-sm text-text-secondary">
            {{ playerSubmittedMessage }} Nhắm mắt và chờ loa đọc tới lượt tiếp theo.
          </p>
        </div>

        <!-- Game over for player -->
        <div
          v-if="room.gameOverWinner.value"
          class="mb-4 border p-6 text-center"
          :class="
            room.gameOverWinner.value === 'wolf'
              ? 'border-accent-coral bg-accent-coral/10'
              : 'border-accent-sky bg-accent-sky/10'
          "
        >
          <div class="mb-2 text-4xl">{{ room.gameOverWinner.value === 'wolf' ? '🐺' : '🏆' }}</div>
          <p
            class="font-display text-2xl font-bold"
            :class="room.gameOverWinner.value === 'wolf' ? 'text-accent-coral' : 'text-accent-sky'"
          >
            {{ room.gameOverWinner.value === 'wolf' ? 'Phe Sói thắng!' : 'Phe Dân thắng!' }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">
            Bạn là
            <span class="font-bold">{{
              room.myRole.value ? ROLE_NAMES[room.myRole.value] : ''
            }}</span>
            ({{ room.myFaction.value === 'wolf' ? 'Phe Sói' : 'Phe Dân' }})
          </p>
        </div>

        <div
          v-if="playerTurnInstruction"
          class="mb-4 border p-4"
          :class="
            playerTurnInstruction.tone === 'warning'
              ? 'border-accent-amber/30 bg-accent-amber/10'
              : 'border-accent-coral/30 bg-accent-coral/10'
          "
        >
          <div
            class="flex items-center gap-2 text-sm font-semibold"
            :class="
              playerTurnInstruction.tone === 'warning' ? 'text-accent-amber' : 'text-accent-coral'
            "
          >
            <Icon :icon="playerTurnInstruction.icon" class="size-4" />
            <span>{{ playerTurnInstruction.title }}</span>
          </div>
          <p class="mt-2 text-sm text-text-secondary">{{ playerTurnInstruction.detail }}</p>
        </div>

        <div
          v-if="
            room.serverPhase.value === 'day-discussion' &&
            !room.gameOverWinner.value &&
            isOnlineAlivePlayer
          "
          class="mb-4 border border-accent-amber/20 bg-bg-surface p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-display text-lg font-bold text-text-primary">
                {{
                  room.serverDiscussionStage.value === 'talking'
                    ? 'Thảo luận ban ngày'
                    : 'Quyết định sau thảo luận'
                }}
              </p>
              <p class="mt-1 text-sm text-text-secondary">
                {{
                  room.serverDiscussionStage.value === 'talking'
                    ? 'Nếu quá nửa người sống bấm bỏ qua, phần thảo luận sẽ dừng ngay.'
                    : 'Nếu quá nửa cùng chọn, ứng dụng sẽ thêm giờ hoặc chuyển thẳng sang đêm.'
                }}
              </p>
            </div>
            <div class="border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-right">
              <p class="text-[10px] uppercase tracking-[0.24em] text-text-dim">Thời gian</p>
              <p class="font-display text-lg font-bold text-accent-amber">
                {{
                  formatTime(
                    room.serverDiscussionStage.value === 'talking'
                      ? room.serverDiscussionTimeLeft.value
                      : room.serverDiscussionDecisionTimeLeft.value,
                  )
                }}
              </p>
            </div>
          </div>

          <div
            v-if="room.serverDiscussionStage.value === 'talking'"
            class="mt-4 rounded-none border border-border-default bg-bg-elevated p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-accent-coral">Bỏ qua thảo luận</p>
                <p class="mt-1 text-xs text-text-dim">
                  {{ playerDiscussionSkipCount }}/{{
                    room.publicPlayers.value.filter((player) => player.alive).length
                  }}
                  người đã chọn
                </p>
              </div>
              <button
                class="border px-4 py-2 text-sm font-semibold transition"
                :class="
                  playerDiscussionSkipSelected
                    ? 'border-accent-coral bg-accent-coral/15 text-accent-coral'
                    : 'border-border-default text-text-secondary hover:border-accent-coral hover:text-accent-coral'
                "
                :disabled="playerDiscussionSkipSelected"
                @click="submitDiscussionSkipVote"
              >
                {{ playerDiscussionSkipSelected ? 'Đã chọn' : 'Bỏ qua' }}
              </button>
            </div>
          </div>

          <div v-else class="mt-4 grid grid-cols-2 gap-3">
            <button
              class="border p-4 text-left transition"
              :class="
                playerDiscussionDecisionSelected === 'extend'
                  ? 'border-accent-amber bg-accent-amber/15 text-accent-amber'
                  : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-amber hover:text-accent-amber'
              "
              @click="submitDiscussionDecision('extend')"
            >
              <p class="font-display text-base font-bold">Thêm thời gian</p>
              <p class="mt-1 text-xs">{{ playerDiscussionExtendCount }} người chọn</p>
            </button>
            <button
              class="border p-4 text-left transition"
              :class="
                playerDiscussionDecisionSelected === 'sleep'
                  ? 'border-accent-coral bg-accent-coral/15 text-accent-coral'
                  : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-coral hover:text-accent-coral'
              "
              @click="submitDiscussionDecision('sleep')"
            >
              <p class="font-display text-base font-bold">Đi ngủ</p>
              <p class="mt-1 text-xs">{{ playerDiscussionSleepCount }} người chọn</p>
            </button>
          </div>
        </div>

        <!-- Passive waiting state -->
        <div
          v-if="
            !playerSubmittedMessage &&
            !room.isMyTurnToAct.value &&
            !room.gameOverWinner.value &&
            ['night', 'day-result', 'day-explain'].includes(room.serverPhase.value)
          "
          class="mb-4 border border-accent-amber/20 bg-bg-surface/80 p-5 text-center"
        >
          <div class="mb-2 flex justify-center">
            <span
              class="flex size-10 items-center justify-center border border-accent-amber/20 bg-accent-amber/10 text-accent-amber"
            >
              <Icon :icon="playerWaitingState.icon" class="size-5" />
            </span>
          </div>
          <p class="font-display text-sm font-semibold text-text-dim">
            {{ playerWaitingState.title }}
          </p>
          <p class="mt-2 text-sm text-text-secondary">{{ playerWaitingState.detail }}</p>
          <div class="mt-3 flex justify-center gap-1">
            <span
              v-for="n in 3"
              :key="n"
              class="size-1.5 animate-bounce rounded-full bg-accent-amber/40"
              :style="`animation-delay: ${(n - 1) * 200}ms`"
            />
          </div>
        </div>

        <!-- ── MY TURN: Night action ── -->
        <div v-if="room.isMyTurnToAct.value && room.serverPhase.value === 'night'" class="mb-4">
          <!-- Generic single-target night action (disruptor, seer, guard, hunter, wolves) -->
          <div
            v-if="
              room.myActionStep.value &&
              ['disruptor', 'seer', 'guard', 'hunter', 'wolves'].includes(room.myActionStep.value)
            "
            class="border border-accent-coral/30 bg-bg-surface p-5"
          >
            <p class="mb-3 font-display text-sm font-semibold text-accent-coral">
              <Icon :icon="STEP_ICON[room.myActionStep.value]" class="mr-1 inline size-4" />
              {{ NIGHT_CALL[room.myActionStep.value] }}
            </p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="p in room.publicPlayers.value.filter(
                  (pl) =>
                    pl.alive &&
                    (room.myActionStep.value === 'guard' || pl.id !== room.myPlayerId.value),
                )"
                :key="p.id"
                class="border py-3 font-display text-sm transition"
                :class="
                  p.id === selectedTarget
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-coral/50'
                "
                @click="selectActionTarget(p.id)"
              >
                {{ p.name }}
              </button>
            </div>
            <button
              class="mt-4 w-full border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral transition hover:bg-accent-coral/20 disabled:opacity-40"
              :disabled="!selectedTarget"
              @click="submitSingleTargetNightAction"
            >
              Xác nhận
            </button>
          </div>

          <!-- Witch action -->
          <div
            v-else-if="room.myActionStep.value === 'witch'"
            class="border border-accent-amber/30 bg-bg-surface p-5"
          >
            <p class="mb-3 font-display text-sm font-semibold text-accent-amber">
              🧙 Phù thủy hành động
            </p>
            <p v-if="room.myActionExtra.value.victimName" class="mb-3 text-sm text-text-secondary">
              Đêm nay
              <span class="font-bold text-accent-coral">{{
                room.myActionExtra.value.victimName
              }}</span>
              bị cắn.
            </p>

            <div class="mb-3 flex gap-2">
              <button
                v-if="room.myActionExtra.value.canSave"
                class="flex-1 border py-2 font-display text-sm transition"
                :class="
                  witchChoice === 'save'
                    ? 'border-accent-sky bg-accent-sky/20 text-accent-sky'
                    : 'border-border-default text-text-secondary hover:border-accent-sky/50'
                "
                @click="witchChoice = witchChoice === 'save' ? 'none' : 'save'"
              >
                💊 Cứu nạn nhân
              </button>
              <button
                v-if="room.myActionExtra.value.canKill"
                class="flex-1 border py-2 font-display text-sm transition"
                :class="
                  witchChoice === 'kill'
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default text-text-secondary hover:border-accent-coral/50'
                "
                @click="witchChoice = witchChoice === 'kill' ? 'none' : 'kill'"
              >
                ☠️ Dùng bình độc
              </button>
            </div>

            <div v-if="witchChoice === 'kill'" class="mb-3 grid grid-cols-2 gap-2">
              <button
                v-for="p in room.publicPlayers.value.filter((pl) => pl.alive)"
                :key="p.id"
                class="border py-2 text-sm transition"
                :class="
                  witchKillTarget === p.id
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default text-text-secondary hover:border-accent-coral/50'
                "
                @click="selectWitchKillTarget(p.id)"
              >
                {{ p.name }}
              </button>
            </div>

            <button
              class="w-full border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber transition hover:bg-accent-amber/20"
              @click="submitWitchAction"
            >
              {{ witchChoice === 'none' ? 'Bỏ qua' : 'Xác nhận' }}
            </button>
          </div>

          <!-- Cupid action -->
          <div
            v-else-if="room.myActionStep.value === 'cupid'"
            class="border border-accent-amber/30 bg-bg-surface p-5"
          >
            <p class="mb-3 font-display text-sm font-semibold text-accent-amber">
              💘 Chọn 2 người yêu nhau
            </p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="p in room.publicPlayers.value.filter((pl) => pl.alive)"
                :key="p.id"
                class="border py-3 font-display text-sm transition"
                :class="
                  cupidChoice1 === p.id || cupidChoice2 === p.id
                    ? 'border-accent-amber bg-accent-amber/20 text-accent-amber'
                    : 'border-border-default text-text-secondary hover:border-accent-amber/50'
                "
                @click="handleCupidPlayerClick(p.id)"
              >
                {{ p.name }}
                <span v-if="cupidChoice1 === p.id || cupidChoice2 === p.id">💘</span>
              </button>
            </div>
            <button
              class="mt-4 w-full border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber disabled:opacity-40"
              :disabled="!cupidChoice1 || !cupidChoice2"
              @click="submitCupidAction"
            >
              Xác nhận
            </button>
          </div>
        </div>

        <!-- ── MY TURN: Nomination ── -->
        <div
          v-if="room.isMyTurnToAct.value && room.myActionExtra.value?.type === 'nomination'"
          class="mb-4 border border-accent-amber/30 bg-bg-surface p-5"
        >
          <p class="mb-3 font-display text-sm font-semibold text-accent-amber">
            Bạn muốn đề cử ai?
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="p in room.publicPlayers.value.filter(
                (pl) => pl.alive && pl.id !== room.myPlayerId.value,
              )"
              :key="p.id"
              class="border py-3 text-sm transition"
              :class="
                selectedTarget === p.id
                  ? 'border-accent-amber bg-accent-amber/20 text-accent-amber'
                  : 'border-border-default text-text-secondary hover:border-accent-amber/50'
              "
              @click="selectActionTarget(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              class="flex-1 border border-border-default py-2 text-sm text-text-dim hover:border-accent-coral hover:text-accent-coral"
              @click="skipNomination"
            >
              Bỏ qua
            </button>
            <button
              class="flex-1 border border-accent-amber bg-accent-amber/10 py-2 font-display text-sm font-semibold text-accent-amber disabled:opacity-40"
              :disabled="!selectedTarget"
              @click="submitNomination"
            >
              Đề cử
            </button>
          </div>
        </div>

        <!-- ── MY TURN: Hang vote ── -->
        <div
          v-if="room.isMyTurnToAct.value && room.myActionExtra.value?.type === 'hang_vote'"
          class="mb-4 border border-accent-coral/30 bg-bg-surface p-5"
        >
          <p class="mb-3 font-display text-sm font-semibold text-accent-coral">
            Bầu ai bị treo cổ?
          </p>
          <div class="mb-3 grid grid-cols-2 gap-2">
            <button
              v-for="nomineeId in room.myActionExtra.value.nominees as string[]"
              :key="nomineeId"
              class="border py-3 text-sm transition"
              :class="
                selectedTarget === nomineeId
                  ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                  : 'border-border-default text-text-secondary hover:border-accent-coral/50'
              "
              @click="selectActionTarget(nomineeId)"
            >
              {{ getPublicPlayerName(nomineeId) }}
            </button>
          </div>
          <div class="flex gap-2">
            <button
              class="flex-1 border border-border-default py-2 text-sm text-text-dim hover:border-accent-coral hover:text-accent-coral"
              @click="skipHangVote"
            >
              Bỏ phiếu trắng
            </button>
            <button
              class="flex-1 border border-accent-coral bg-accent-coral/10 py-2 font-display text-sm font-semibold text-accent-coral disabled:opacity-40"
              :disabled="!selectedTarget"
              @click="submitHangVote"
            >
              Bầu
            </button>
          </div>
        </div>

        <button
          class="mt-4 text-xs text-text-dim hover:text-accent-coral"
          @click="leaveRoomAndSelectMode"
        >
          Thoát phòng
        </button>
      </div>
    </div>

    <!-- ══════════════════════════ HOST / OFFLINE GAME ══ -->
    <template v-else>
      <div
        v-if="room.isOnline.value && g.phase.value !== 'setup'"
        class="sticky top-0 z-20 border-b border-border-default bg-bg-deep/95 backdrop-blur"
      >
        <div class="mx-auto flex max-w-lg flex-wrap items-center gap-2 px-4 py-3">
          <div class="min-w-[7rem] flex-1 border border-border-default bg-bg-surface px-3 py-2">
            <p class="text-[10px] uppercase tracking-[0.24em] text-text-dim">Pha hiện tại</p>
            <p class="font-display text-sm font-bold text-text-primary">
              {{
                g.phase.value === 'night'
                  ? STEP_LABELS[g.nightStep.value]
                  : g.phase.value === 'day-result'
                    ? 'Kết quả đêm qua'
                    : g.phase.value === 'day-discussion'
                      ? 'Thảo luận'
                      : g.phase.value === 'day-nominate'
                        ? 'Bỏ phiếu đề cử'
                        : g.phase.value === 'day-explain'
                          ? 'Giải thích'
                          : g.phase.value === 'day-hang'
                            ? 'Bỏ phiếu treo cổ'
                            : g.phase.value === 'game-over'
                              ? 'Kết thúc'
                              : 'Đang chơi'
              }}
            </p>
          </div>
          <div class="min-w-[7rem] flex-1 border border-border-default bg-bg-surface px-3 py-2">
            <p class="text-[10px] uppercase tracking-[0.24em] text-text-dim">Thời gian</p>
            <p class="font-display text-sm font-bold text-accent-amber">
              {{
                g.phase.value === 'night' && g.nightUiState.value === 'acting'
                  ? formatTime(g.nightActionTimeLeft.value)
                  : g.phase.value === 'day-discussion'
                    ? formatTime(
                        g.discussionStage.value === 'talking'
                          ? g.discussionTimeLeft.value
                          : g.discussionDecisionTimeLeft.value,
                      )
                    : '—'
              }}
            </p>
          </div>
          <div class="min-w-[6rem] flex-1 border border-border-default bg-bg-surface px-3 py-2">
            <p class="text-[10px] uppercase tracking-[0.24em] text-text-dim">Còn sống</p>
            <p class="font-display text-sm font-bold text-accent-sky">
              {{ g.livingPlayers.value.length }}/{{ g.players.value.length }}
            </p>
          </div>
          <button
            class="border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
            @click="showSelfPanel = true"
          >
            Vai của tôi
          </button>
          <button
            class="border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
            @click="showPlayersPopover = true"
          >
            Người chơi
          </button>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ SETUP ══ -->
      <div v-if="g.phase.value === 'setup'" class="mx-auto max-w-lg px-4 py-8">
        <div class="mb-6 flex items-center justify-between">
          <button
            class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
            @click="backFromGameSetup"
          >
            <Icon icon="lucide:arrow-left" class="size-3.5" />
            {{ room.isOnline.value ? 'Phòng' : 'Trang chủ' }}
          </button>
          <div class="flex gap-2">
            <button
              class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
              @click="showGuide = true"
            >
              <Icon icon="lucide:book-open" class="size-3.5" /> Hướng dẫn
            </button>
            <button
              class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
              @click="showSpeechSettings = true"
            >
              <Icon icon="lucide:settings-2" class="size-3.5" /> Giọng đọc
            </button>
          </div>
        </div>

        <h1 class="mb-1 font-display text-3xl font-bold">Ma Sói Tự Dẫn</h1>
        <p class="mb-8 text-sm text-text-secondary">
          Ứng dụng tự điều phối ván chơi, đọc loa và xử lý luồng game thay cho người dẫn.
        </p>

        <!-- In online mode, this shows after host starts game and we're in setup briefly -->
        <div
          v-if="room.isOnline.value"
          class="mb-6 border border-accent-amber/30 bg-accent-amber/5 p-3"
        >
          <p class="text-xs text-accent-amber">
            🔗 Chế độ online — Mã phòng:
            <span class="font-bold tracking-widest">{{ room.roomId.value }}</span>
          </p>
        </div>

        <!-- Players section (offline only) -->
        <div v-if="!room.isOnline.value" class="mb-6">
          <p class="mb-3 font-display text-xs tracking-widest text-text-dim uppercase">
            <span class="text-accent-coral">//</span> Người chơi
            <span class="ml-2 text-accent-amber">({{ g.players.value.length }})</span>
          </p>
          <div class="mb-3 flex gap-2">
            <input
              v-model="g.playerNameInput.value"
              type="text"
              placeholder="Nhập tên người chơi..."
              class="flex-1 border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-dim focus:border-accent-coral focus:outline-none"
              :class="g.duplicateNameError.value ? 'border-accent-coral' : ''"
              @keyup.enter="g.addPlayer"
            />
            <button
              class="border border-accent-coral bg-accent-coral/10 px-4 py-2.5 text-sm text-accent-coral transition hover:bg-accent-coral/20"
              @click="g.addPlayer"
            >
              <Icon icon="lucide:plus" class="size-4" />
            </button>
          </div>
          <p v-if="g.duplicateNameError.value" class="mb-2 text-xs text-accent-coral">
            Tên này đã có trong danh sách!
          </p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="p in g.players.value"
              :key="p.id"
              class="flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-1.5 text-sm"
            >
              {{ p.name }}
              <button class="text-text-dim hover:text-accent-coral" @click="g.removePlayer(p.id)">
                <Icon icon="lucide:x" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Roles section -->
        <div class="mb-6">
          <p class="mb-3 font-display text-xs tracking-widest text-text-dim uppercase">
            <span class="text-accent-amber">//</span> Vai trò
            <span
              class="ml-2"
              :class="
                g.totalRoles.value === g.players.value.length
                  ? 'text-accent-sky'
                  : 'text-accent-coral'
              "
            >
              {{ g.totalRoles.value }}/{{ g.players.value.length }}
            </span>
          </p>
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              v-for="preset in PRESETS"
              :key="preset.label"
              class="border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
              @click="applyPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>

          <p class="mb-2 font-display text-xs text-accent-coral">Phe Sói</p>
          <div class="mb-4 space-y-2">
            <div
              v-for="r in CONFIGURABLE_ROLES.filter((x) => x.faction === 'wolf')"
              :key="r.id"
              class="flex items-center justify-between border border-border-default bg-bg-surface px-4 py-3"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-base">{{ ROLE_EMOJI[r.id] }}</span>
                  <span class="font-display text-sm font-semibold">{{ ROLE_NAMES[r.id] }}</span>
                  <span
                    class="ml-2 font-display text-xs font-bold"
                    :class="ROLE_POINTS[r.id] < 0 ? 'text-accent-coral' : 'text-accent-sky'"
                  >
                    {{ ROLE_POINTS[r.id] > 0 ? '+' : '' }}{{ ROLE_POINTS[r.id] }}
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-text-dim">{{ ROLE_DESC[r.id] }}</p>
              </div>
              <div class="ml-4 flex items-center gap-2">
                <button
                  class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-coral hover:text-accent-coral"
                  @click="g.setRoleCount(r.id, -1)"
                >
                  <Icon icon="lucide:minus" class="size-3.5" />
                </button>
                <span class="w-5 text-center font-display font-bold text-text-primary">{{
                  g.roleConfig.value[r.id]
                }}</span>
                <button
                  class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-coral hover:text-accent-coral"
                  @click="g.setRoleCount(r.id, 1)"
                >
                  <Icon icon="lucide:plus" class="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <p class="mb-2 font-display text-xs text-accent-sky">Phe Dân</p>
          <div class="space-y-2">
            <div
              v-for="r in CONFIGURABLE_ROLES.filter((x) => x.faction === 'villager')"
              :key="r.id"
              class="flex items-center justify-between border border-border-default bg-bg-surface px-4 py-3"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-base">{{ ROLE_EMOJI[r.id] }}</span>
                  <span class="font-display text-sm font-semibold">{{ ROLE_NAMES[r.id] }}</span>
                  <span
                    class="ml-2 font-display text-xs font-bold"
                    :class="ROLE_POINTS[r.id] < 0 ? 'text-accent-coral' : 'text-accent-sky'"
                  >
                    {{ ROLE_POINTS[r.id] > 0 ? '+' : '' }}{{ ROLE_POINTS[r.id] }}
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-text-dim">{{ ROLE_DESC[r.id] }}</p>
              </div>
              <div class="ml-4 flex items-center gap-2">
                <button
                  class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-sky hover:text-accent-sky"
                  @click="g.setRoleCount(r.id, -1)"
                >
                  <Icon icon="lucide:minus" class="size-3.5" />
                </button>
                <span class="w-5 text-center font-display font-bold text-text-primary">{{
                  g.roleConfig.value[r.id]
                }}</span>
                <button
                  class="flex size-7 items-center justify-center border border-border-default text-text-dim transition hover:border-accent-sky hover:text-accent-sky"
                  @click="g.setRoleCount(r.id, 1)"
                >
                  <Icon icon="lucide:plus" class="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 border border-border-default bg-bg-surface px-4 py-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-dim">Điểm cân bằng</span>
              <span
                class="font-display text-sm font-bold"
                :class="
                  Math.abs(balanceScore) <= 3
                    ? 'text-accent-sky'
                    : balanceScore < 0
                      ? 'text-accent-coral'
                      : 'text-accent-amber'
                "
              >
                {{ balanceScore > 0 ? '+' : '' }}{{ balanceScore }}
                <span class="ml-1 text-xs font-normal text-text-dim">{{
                  Math.abs(balanceScore) <= 3
                    ? '(cân bằng)'
                    : balanceScore < 0
                      ? '(nghiêng về Sói)'
                      : '(nghiêng về Dân)'
                }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Time config -->
        <div class="mb-6">
          <button
            class="flex w-full items-center justify-between border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-secondary transition hover:border-accent-coral"
            @click="showTimeConfig = !showTimeConfig"
          >
            <span class="flex items-center gap-2"
              ><Icon icon="lucide:timer" class="size-4" /> Cấu hình thời gian</span
            >
            <Icon
              :icon="showTimeConfig ? 'lucide:chevron-up' : 'lucide:chevron-down'"
              class="size-4"
            />
          </button>
          <div
            v-if="showTimeConfig"
            class="space-y-3 border border-t-0 border-border-default bg-bg-surface p-4"
          >
            <div
              v-for="[key, label] in [
                ['discussionSeconds', 'Thảo luận (giây)'],
                ['discussionDecisionSeconds', 'Quyết định sau thảo luận (giây)'],
                ['discussionExtendSeconds', 'Mỗi lần thêm thời gian (giây)'],
                ['nightActionSeconds', 'Vai ban đêm thao tác (giây)'],
                ['nominateSeconds', 'Bỏ phiếu đề cử/người (giây)'],
                ['explainSeconds', 'Giải thích (giây)'],
                ['hangVoteSeconds', 'Bỏ phiếu treo cổ/người (giây)'],
                ['nightDelayMs', 'Delay giữa bước đêm (ms)'],
              ]"
              :key="key"
              class="flex items-center justify-between"
            >
              <label class="text-xs text-text-secondary">{{ label }}</label>
              <input
                type="number"
                :value="(g.timeConfig.value as Record<string, number>)[key as string]"
                class="w-24 border border-border-default bg-bg-deep px-2 py-1 text-right text-sm text-text-primary focus:border-accent-coral focus:outline-none"
                @input="updateTimeConfig(key as string, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <button
          class="w-full border py-4 font-display text-lg font-bold tracking-wide transition"
          :class="
            g.setupValid.value
              ? 'border-accent-coral bg-accent-coral/10 text-accent-coral hover:bg-accent-coral/20'
              : 'cursor-not-allowed border-border-default text-text-dim'
          "
          :disabled="!g.setupValid.value"
          @click="g.startGame"
        >
          Bắt đầu game
        </button>
        <p v-if="!g.setupValid.value" class="mt-2 text-center text-xs text-text-dim">
          <span v-if="g.players.value.length < 3">Cần ít nhất 3 người chơi. </span>
          <span v-if="g.totalRoles.value !== g.players.value.length"
            >Tổng vai ({{ g.totalRoles.value }}) phải bằng số người ({{
              g.players.value.length
            }}).</span
          >
        </p>
      </div>

      <!-- ══════════════════════════════════════════════ ROLE REVEAL ══ -->
      <div
        v-else-if="g.phase.value === 'role-reveal'"
        class="flex min-h-screen flex-col items-center justify-center px-4"
      >
        <div class="w-full max-w-sm text-center">
          <p class="mb-2 font-display text-xs tracking-widest text-text-dim uppercase">
            Xem bài —
            <span class="text-accent-amber"
              >{{ g.roleRevealIndex.value + 1 }}/{{ g.players.value.length }}</span
            >
          </p>

          <!-- Online mode: roles sent to player phones -->
          <div v-if="room.isOnline.value" class="border border-accent-sky bg-bg-surface p-8">
            <div class="mb-3 text-3xl">📱</div>
            <p class="mb-3 font-display text-lg font-bold text-accent-sky">Đã chia vai</p>
            <p class="mb-6 text-sm text-text-secondary">
              Bảo mọi người xem role trên máy của mình. Máy chính có thể mở nút "Vai của tôi" để xem
              lại role.
            </p>
            <div
              v-if="room.myRole.value"
              class="mb-6 border p-4 text-left"
              :class="
                room.myFaction.value === 'wolf'
                  ? 'border-accent-coral/30 bg-accent-coral/5'
                  : 'border-accent-sky/30 bg-accent-sky/5'
              "
            >
              <p class="mb-2 text-xs tracking-widest text-text-dim uppercase">Vai của máy chính</p>
              <div class="flex items-center gap-3">
                <span class="text-3xl">{{ ROLE_EMOJI[room.myRole.value] }}</span>
                <div>
                  <p class="font-display text-lg font-bold">{{ ROLE_NAMES[room.myRole.value] }}</p>
                  <p class="text-xs text-text-secondary">{{ ROLE_DESC[room.myRole.value] }}</p>
                </div>
              </div>
            </div>
            <button
              class="w-full border border-accent-coral bg-accent-coral/10 py-3 font-display font-semibold text-accent-coral transition hover:bg-accent-coral/20"
              @click="skipToNight()"
            >
              <Icon icon="lucide:moon" class="mr-2 inline size-4" /> Bắt đầu đêm đầu tiên
            </button>
          </div>

          <!-- Offline mode: pass the phone -->
          <template v-else>
            <div
              v-if="!g.roleRevealShowing.value"
              class="border border-border-default bg-bg-surface p-8"
            >
              <p class="mb-6 font-display text-2xl font-bold text-accent-amber">
                {{ g.players.value[g.roleRevealIndex.value]?.name }}
              </p>
              <p class="mb-6 text-sm text-text-secondary">
                Truyền điện thoại cho người này, rồi bấm xem bài.
              </p>
              <button
                class="w-full border border-accent-coral bg-accent-coral/10 py-3 font-display font-semibold text-accent-coral transition hover:bg-accent-coral/20"
                @click="g.showRoleCard"
              >
                <Icon icon="lucide:eye" class="mr-2 inline size-4" /> Xem vai
              </button>
            </div>
            <div v-else class="border border-accent-amber bg-bg-surface p-8">
              <div class="mb-3 text-5xl">
                {{ ROLE_EMOJI[g.players.value[g.roleRevealIndex.value]?.role ?? 'villager'] }}
              </div>
              <p class="mb-1 font-display text-3xl font-bold text-accent-amber">
                {{ ROLE_NAMES[g.players.value[g.roleRevealIndex.value]?.role ?? 'villager'] }}
              </p>
              <p
                class="mb-2 font-display text-xs font-semibold"
                :class="
                  ['wolf', 'wolf-cub', 'cursed-wolf', 'traitor'].includes(
                    g.players.value[g.roleRevealIndex.value]?.role ?? '',
                  )
                    ? 'text-accent-coral'
                    : 'text-accent-sky'
                "
              >
                {{
                  ['wolf', 'wolf-cub', 'cursed-wolf', 'traitor'].includes(
                    g.players.value[g.roleRevealIndex.value]?.role ?? '',
                  )
                    ? 'Phe Sói 🐺'
                    : 'Phe Dân 👥'
                }}
              </p>
              <p class="mb-6 text-sm text-text-secondary">
                {{ ROLE_DESC[g.players.value[g.roleRevealIndex.value]?.role ?? 'villager'] }}
              </p>
              <button
                class="w-full border border-accent-sky bg-accent-sky/10 py-3 font-display font-semibold text-accent-sky transition hover:bg-accent-sky/20"
                @click="g.nextRoleReveal"
              >
                <Icon icon="lucide:check" class="mr-2 inline size-4" /> Đã xem — đưa điện thoại lại
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ NIGHT ══ -->
      <div
        v-else-if="g.phase.value === 'night'"
        class="flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4"
        style="background: radial-gradient(ellipse at top, #1a1008 0%, #0f0a05 100%)"
      >
        <div class="w-full max-w-sm">
          <div class="mb-6 text-center">
            <div class="mb-2 text-4xl">🌙</div>
            <h2 class="font-display text-2xl font-bold text-accent-amber">
              Đêm {{ g.roundNumber.value }}
            </h2>
            <div class="mt-3 flex justify-center gap-1.5">
              <div
                v-for="(step, i) in NIGHT_ORDER"
                :key="step"
                class="h-1 w-6 transition-all"
                :class="
                  i < currentStepIndex
                    ? 'bg-accent-coral/60'
                    : i === currentStepIndex
                      ? 'bg-accent-amber'
                      : 'bg-border-default'
                "
              />
            </div>
          </div>

          <!-- Calling / waiting / sleeping -->
          <div
            v-if="
              g.nightUiState.value === 'calling' ||
              g.nightUiState.value === 'fake-wait' ||
              g.nightUiState.value === 'sleeping'
            "
            class="border border-accent-amber/20 bg-bg-surface/80 p-6 text-center backdrop-blur"
          >
            <Icon
              :icon="STEP_ICON[g.nightStep.value]"
              class="mx-auto mb-3 size-8 text-accent-amber/60"
            />
            <p class="font-display text-lg font-semibold text-text-dim">
              {{ STEP_LABELS[g.nightStep.value] }}
            </p>
            <p class="mt-2 text-sm text-text-dim italic">{{ NIGHT_CALL[g.nightStep.value] }}</p>
            <div class="mt-4 flex justify-center gap-1">
              <span
                v-for="n in 3"
                :key="n"
                class="size-1.5 animate-bounce rounded-full bg-accent-amber/40"
                :style="`animation-delay: ${(n - 1) * 200}ms`"
              />
            </div>
          </div>

          <!-- Acting (offline only or online override) -->
          <div v-else-if="g.nightUiState.value === 'acting'">
            <!-- Online: waiting indicator with override -->
            <div
              v-if="room.isOnline.value"
              class="border border-accent-amber/30 bg-bg-surface p-5 text-center"
            >
              <Icon
                :icon="STEP_ICON[g.nightStep.value]"
                class="mx-auto mb-3 size-8 text-accent-amber"
              />
              <p class="mb-2 font-display text-sm font-semibold text-accent-amber">
                {{ STEP_LABELS[g.nightStep.value] }}
              </p>
              <p class="mb-4 text-xs text-text-dim">Đợi người tới lượt hoàn thành thao tác.</p>
              <div class="flex justify-center gap-1 mb-4">
                <span
                  v-for="n in 3"
                  :key="n"
                  class="size-1.5 animate-bounce rounded-full bg-accent-amber/40"
                  :style="`animation-delay: ${(n - 1) * 200}ms`"
                />
              </div>
            </div>

            <!-- DISRUPTOR ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'disruptor'"
              class="border border-accent-coral/30 bg-bg-surface p-5"
            >
              <p class="mb-4 font-display text-sm font-semibold text-accent-coral">
                <Icon icon="lucide:volume-x" class="mr-1 inline size-4" /> Chọn người cấm nói
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in g.livingPlayers.value.filter((p) => p.role !== 'disruptor')"
                  :key="p.id"
                  class="border py-3 font-display text-sm transition"
                  :class="
                    g.disruptorTarget.value === p.id
                      ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                      : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-coral/50'
                  "
                  @click="g.setDisruptorTarget(p.id)"
                >
                  {{ p.name }}
                </button>
              </div>
              <button
                class="mt-4 w-full border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral disabled:opacity-40"
                :disabled="!g.disruptorTarget.value"
                @click="g.confirmDisruptor"
              >
                Xác nhận
              </button>
            </div>

            <!-- CUPID ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'cupid'"
              class="border border-accent-amber/30 bg-bg-surface p-5"
            >
              <p class="mb-4 font-display text-sm font-semibold text-accent-amber">
                <Icon icon="lucide:heart" class="mr-1 inline size-4" /> Chọn 2 người yêu nhau
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in g.livingPlayers.value"
                  :key="p.id"
                  class="border py-3 font-display text-sm transition"
                  :class="[
                    g.cupidTarget1.value === p.id || g.cupidTarget2.value === p.id
                      ? 'border-accent-amber bg-accent-amber/20 text-accent-amber'
                      : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-amber/50',
                  ]"
                  @click="handleCupidClick(p.id)"
                >
                  {{ p.name
                  }}<span v-if="g.cupidTarget1.value === p.id || g.cupidTarget2.value === p.id"
                    >💘</span
                  >
                </button>
              </div>
              <button
                class="mt-4 w-full border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber disabled:opacity-40"
                :disabled="!g.cupidTarget1.value || !g.cupidTarget2.value"
                @click="g.confirmCupid"
              >
                Xác nhận
              </button>
            </div>

            <!-- WOLVES ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'wolves'"
              class="border border-accent-coral/40 bg-bg-surface p-5"
            >
              <p class="mb-1 font-display text-sm font-semibold text-accent-coral">
                <Icon icon="lucide:moon" class="mr-1 inline size-4" /> Bầy Sói chọn nạn nhân
                <span v-if="wolfBiteCount > 1" class="ml-1 text-accent-amber"
                  >(2 người — Sói con vừa chết)</span
                >
              </p>
              <p v-if="currentWolfVoter" class="mb-3 text-xs text-text-dim">
                Lượt của:
                <span class="font-semibold text-accent-amber">{{ currentWolfVoter.name }}</span>
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in g.livingPlayers.value.filter((pl) => pl.faction !== 'wolf')"
                  :key="p.id"
                  class="relative border py-3 font-display text-sm transition"
                  :class="
                    g.wolfVotes.value[currentWolfVoter?.id ?? ''] === p.id
                      ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                      : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-coral/50'
                  "
                  @click="currentWolfVoter && g.setWolfVote(currentWolfVoter.id, p.id)"
                >
                  {{ p.name }}
                  <span
                    v-if="wolfVoteTally[p.id]"
                    class="absolute right-1.5 top-1 text-xs text-accent-amber"
                    >{{ wolfVoteTally[p.id] }}</span
                  >
                </button>
              </div>
              <div class="mt-3 space-y-1">
                <div
                  v-for="wolf in livingBitingWolves"
                  :key="wolf.id"
                  class="flex items-center justify-between text-xs"
                >
                  <span class="text-text-dim">{{ wolf.name }}</span>
                  <span :class="g.wolfVotes.value[wolf.id] ? 'text-accent-sky' : 'text-text-dim'">{{
                    g.wolfVotes.value[wolf.id]
                      ? getPlayerName(g.wolfVotes.value[wolf.id])
                      : 'Chưa chọn'
                  }}</span>
                </div>
              </div>
              <div class="mt-4 flex gap-2">
                <button
                  v-if="currentWolfVoter && g.wolfVotes.value[currentWolfVoter.id]"
                  class="flex-1 border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber transition hover:bg-accent-amber/20"
                  @click="handleWolfVoteNext"
                >
                  {{ wolvesYetToVote.length > 1 ? 'Sói tiếp theo' : 'Xong' }}
                </button>
                <button
                  v-if="allWolvesVoted && wolvesYetToVote.length === 0"
                  class="flex-1 border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral transition hover:bg-accent-coral/20"
                  @click="g.confirmWolfVotes"
                >
                  Xác nhận cắn
                </button>
              </div>
              <button
                v-if="
                  livingBitingWolves.length === 1 && g.wolfVotes.value[livingBitingWolves[0]!.id]
                "
                class="mt-2 w-full border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral"
                @click="g.confirmWolfVotes"
              >
                Xác nhận
              </button>
            </div>

            <!-- SEER ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'seer'"
              class="border border-accent-sky/30 bg-bg-surface p-5"
            >
              <p class="mb-4 font-display text-sm font-semibold text-accent-sky">
                <Icon icon="lucide:eye" class="mr-1 inline size-4" /> Soi 1 người
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in g.livingPlayers.value.filter((pl) => pl.role !== 'seer')"
                  :key="p.id"
                  class="border py-3 font-display text-sm transition"
                  :class="
                    g.seerTarget.value === p.id
                      ? 'border-accent-sky bg-accent-sky/20 text-accent-sky'
                      : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-sky/50'
                  "
                  @click="g.setSeerTarget(p.id)"
                >
                  {{ p.name }}
                </button>
              </div>
              <div
                v-if="g.seerTarget.value && g.seerResult.value !== null"
                class="mt-4 border p-3 text-center font-display text-sm font-bold"
                :class="
                  g.seerResult.value
                    ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                    : 'border-accent-sky bg-accent-sky/10 text-accent-sky'
                "
              >
                {{ getPlayerName(g.seerTarget.value) }}:
                {{ g.seerResult.value ? '🐺 Là Sói!' : '👤 Là Dân' }}
              </div>
              <button
                class="mt-4 w-full border border-accent-sky bg-accent-sky/10 py-3 font-display text-sm font-semibold text-accent-sky disabled:opacity-40"
                :disabled="!g.seerTarget.value"
                @click="g.confirmSeer"
              >
                {{ g.seerResult.value === null ? 'Xác nhận để soi' : 'Tiếp tục' }}
              </button>
            </div>

            <!-- GUARD ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'guard'"
              class="border border-accent-sky/30 bg-bg-surface p-5"
            >
              <p class="mb-4 font-display text-sm font-semibold text-accent-sky">
                <Icon icon="lucide:shield" class="mr-1 inline size-4" /> Bảo vệ 1 người
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in g.livingPlayers.value"
                  :key="p.id"
                  class="border py-3 font-display text-sm transition"
                  :class="
                    isGuardDisabled(p.id)
                      ? 'cursor-not-allowed opacity-40 border-border-default'
                      : g.guardTarget.value === p.id
                        ? 'border-accent-sky bg-accent-sky/20 text-accent-sky'
                        : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-sky/50'
                  "
                  :disabled="isGuardDisabled(p.id)"
                  @click="!isGuardDisabled(p.id) && g.setGuardTarget(p.id)"
                >
                  {{ p.name }}
                </button>
              </div>
              <button
                class="mt-4 w-full border border-accent-sky bg-accent-sky/10 py-3 font-display text-sm font-semibold text-accent-sky disabled:opacity-40"
                :disabled="!g.guardTarget.value"
                @click="g.confirmGuard"
              >
                Xác nhận
              </button>
            </div>

            <!-- WITCH ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'witch'"
              class="border border-accent-amber/30 bg-bg-surface p-5"
            >
              <p class="mb-3 font-display text-sm font-semibold text-accent-amber">
                <Icon icon="lucide:flask-conical" class="mr-1 inline size-4" /> Phù thủy
              </p>
              <p v-if="g.witchNightVictim.value" class="mb-3 text-sm text-text-secondary">
                Đêm nay
                <span class="font-bold text-accent-coral">{{
                  getPlayerName(g.witchNightVictim.value)
                }}</span>
                bị cắn.
              </p>
              <div class="mb-3 flex gap-2">
                <button
                  v-if="witchCanSave"
                  class="flex-1 border py-2 font-display text-sm transition"
                  :class="
                    g.witchSaved.value
                      ? 'border-accent-sky bg-accent-sky/20 text-accent-sky'
                      : 'border-border-default text-text-secondary hover:border-accent-sky/50'
                  "
                  @click="g.witchDoSave"
                >
                  💊 Cứu
                </button>
                <button
                  v-if="witchCanKill"
                  class="flex-1 border py-2 font-display text-sm transition"
                  :class="
                    g.witchKillTarget.value
                      ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                      : 'border-border-default text-text-secondary hover:border-accent-coral/50'
                  "
                  @click="toggleOfflineWitchKillTargets"
                >
                  ☠️ Độc
                </button>
              </div>
              <div
                v-if="showWitchKillTargets && !g.witchSaved.value"
                class="mb-3 grid grid-cols-2 gap-2"
              >
                <button
                  v-for="p in g.livingPlayers.value"
                  :key="p.id"
                  class="border py-2 text-sm transition"
                  :class="
                    g.witchKillTarget.value === p.id
                      ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                      : 'border-border-default text-text-secondary hover:border-accent-coral/50'
                  "
                  @click="g.witchSetKill(g.witchKillTarget.value === p.id ? null : p.id)"
                >
                  {{ p.name }}
                </button>
              </div>
              <button
                class="w-full border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber"
                @click="confirmOfflineWitch"
              >
                {{ g.witchSaved.value || g.witchKillTarget.value ? 'Xác nhận' : 'Bỏ qua' }}
              </button>
            </div>

            <!-- HUNTER ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'hunter'"
              class="border border-accent-amber/30 bg-bg-surface p-5"
            >
              <p class="mb-4 font-display text-sm font-semibold text-accent-amber">
                <Icon icon="lucide:crosshair" class="mr-1 inline size-4" /> Thợ săn chỉ định
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in g.livingPlayers.value.filter((pl) => pl.role !== 'hunter')"
                  :key="p.id"
                  class="border py-3 font-display text-sm transition"
                  :class="
                    g.hunterTarget.value === p.id
                      ? 'border-accent-amber bg-accent-amber/20 text-accent-amber'
                      : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-amber/50'
                  "
                  @click="g.setHunterTarget(p.id)"
                >
                  {{ p.name }}
                </button>
              </div>
              <button
                class="mt-4 w-full border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber disabled:opacity-40"
                :disabled="!g.hunterTarget.value"
                @click="g.confirmHunter"
              >
                Xác nhận
              </button>
            </div>

            <!-- TRAITOR ACTION (offline) -->
            <div
              v-else-if="g.nightStep.value === 'traitor'"
              class="border border-accent-coral/30 bg-bg-surface p-5"
            >
              <p class="mb-3 font-display text-sm font-semibold text-accent-coral">
                🎭 Kẻ phản bội xem bầy Sói
              </p>
              <div class="mb-4 space-y-1">
                <div
                  v-for="wolf in g.livingWolves.value.filter((w) => w.role !== 'traitor')"
                  :key="wolf.id"
                  class="border border-accent-coral/30 bg-accent-coral/5 px-4 py-2 font-display text-sm text-accent-coral"
                >
                  🐺 {{ wolf.name }}
                </div>
              </div>
              <button
                class="w-full border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral"
                @click="g.confirmTraitor"
              >
                Đã xem
              </button>
            </div>
          </div>

          <!-- Controls -->
          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
              @click="g.togglePause"
            >
              {{ g.isPaused.value ? '▶ Tiếp tục' : '⏸ Tạm dừng' }}
            </button>
            <button
              v-if="g.nightSnapshot.value"
              class="flex-1 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
              @click="g.goBackToNight"
            >
              <Icon icon="lucide:rotate-ccw" class="mr-1 inline size-3.5" /> Làm lại đêm
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ DAY RESULT ══ -->
      <div
        v-else-if="g.phase.value === 'day-result'"
        class="flex min-h-screen flex-col items-center justify-center px-4"
      >
        <div class="w-full max-w-sm">
          <div class="mb-4 text-center">
            <div class="mb-2 text-4xl">☀️</div>
            <h2 class="font-display text-2xl font-bold text-accent-amber">
              Ngày {{ g.roundNumber.value }}
            </h2>
          </div>
          <div
            v-if="g.dayDeaths.value.length === 0"
            class="mb-6 border border-accent-sky/30 bg-bg-surface p-6 text-center"
          >
            <p class="font-display text-lg font-semibold text-accent-sky">Đêm qua bình yên</p>
            <p class="mt-1 text-sm text-text-dim">Không ai chết.</p>
          </div>
          <div v-else class="mb-6 space-y-2">
            <p class="font-display text-sm font-semibold text-accent-coral">Đêm qua đã chết:</p>
            <div
              v-for="d in g.dayDeaths.value"
              :key="d.playerId"
              class="flex items-center justify-between border border-accent-coral/30 bg-accent-coral/5 px-4 py-3"
            >
              <span class="font-semibold">{{ getPlayerName(d.playerId) }}</span>
              <span class="text-xs text-text-dim">{{ getDeathReasonLabel(d.reason) }}</span>
            </div>
          </div>
          <div
            v-if="g.currentNightSilenced.value"
            class="mb-4 border border-accent-amber/30 bg-accent-amber/5 px-4 py-3 text-sm"
          >
            🤫
            <span class="font-semibold">{{ getPlayerName(g.currentNightSilenced.value) }}</span> bị
            cấm thảo luận hôm nay.
          </div>
          <button
            class="w-full border border-accent-amber bg-accent-amber/10 py-4 font-display text-lg font-bold text-accent-amber transition hover:bg-accent-amber/20"
            @click="g.acknowledgeDayResult"
          >
            Tiếp tục thảo luận
          </button>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ DAY DISCUSSION ══ -->
      <div
        v-else-if="g.phase.value === 'day-discussion'"
        class="flex min-h-screen flex-col items-center justify-center px-4"
      >
        <div class="w-full max-w-sm">
          <div class="mb-6 text-center">
            <div class="mb-2 text-4xl">💬</div>
            <h2 class="font-display text-2xl font-bold">
              {{ g.discussionStage.value === 'talking' ? 'Thảo luận' : 'Quyết định sau thảo luận' }}
            </h2>
            <p class="mt-1 font-display text-4xl font-bold text-accent-amber">
              {{
                formatTime(
                  g.discussionStage.value === 'talking'
                    ? g.discussionTimeLeft.value
                    : g.discussionDecisionTimeLeft.value,
                )
              }}
            </p>
          </div>
          <div class="mb-4 grid grid-cols-2 gap-2">
            <div
              v-for="p in g.livingPlayers.value"
              :key="p.id"
              class="flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-sm"
            >
              <span v-if="p.isSilenced" class="text-xs">🤫</span>
              <span :class="p.isSilenced ? 'line-through text-text-dim' : ''">{{ p.name }}</span>
            </div>
          </div>
          <div
            v-if="g.discussionStage.value === 'talking'"
            class="space-y-4 border border-accent-coral/20 bg-bg-surface p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-display text-base font-bold text-text-primary">Bỏ qua thảo luận</p>
                <p class="mt-1 text-sm text-text-secondary">
                  Cần {{ g.discussionMajority.value }} / {{ g.livingPlayers.value.length }} người
                  sống đồng ý.
                </p>
              </div>
              <div class="text-right">
                <p class="font-display text-2xl font-bold text-accent-coral">
                  {{ g.discussionSkipVoteCount.value }}
                </p>
                <p class="text-xs text-text-dim">phiếu hiện tại</p>
              </div>
            </div>
            <div class="flex gap-3">
              <button
                class="flex-1 border border-border-default bg-bg-surface py-3 font-display text-sm font-semibold text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
                @click="g.togglePause"
              >
                {{ g.isPaused.value ? '▶ Tiếp tục' : '⏸ Tạm dừng' }}
              </button>
              <button
                class="flex-1 border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral transition hover:bg-accent-coral/20 disabled:opacity-40"
                :disabled="
                  room.isOnline.value &&
                  (!room.myPlayerId.value ||
                    Boolean(g.discussionSkipVotes.value[room.myPlayerId.value]))
                "
                @click="room.isOnline.value ? submitDiscussionSkipVote() : g.skipDiscussion()"
              >
                {{
                  room.isOnline.value &&
                  room.myPlayerId.value &&
                  g.discussionSkipVotes.value[room.myPlayerId.value]
                    ? 'Đã chọn'
                    : 'Bỏ qua thảo luận'
                }}
              </button>
            </div>
          </div>

          <div v-else class="space-y-4 border border-accent-amber/20 bg-bg-surface p-4">
            <p class="text-sm text-text-secondary">
              Hết thời gian thảo luận. Mọi người chọn thêm giờ hoặc đi ngủ.
            </p>
            <div class="grid grid-cols-2 gap-3">
              <button
                class="border p-4 text-left transition"
                :class="
                  room.isOnline.value &&
                  room.myPlayerId.value &&
                  g.discussionDecisionVotes.value[room.myPlayerId.value] === 'extend'
                    ? 'border-accent-amber bg-accent-amber/15 text-accent-amber'
                    : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-amber hover:text-accent-amber'
                "
                @click="
                  room.isOnline.value ? submitDiscussionDecision('extend') : g.extendDiscussion()
                "
              >
                <p class="font-display text-base font-bold">Thêm thời gian</p>
                <p class="mt-1 text-xs">{{ g.discussionExtendVoteCount.value }} người chọn</p>
              </button>
              <button
                class="border p-4 text-left transition"
                :class="
                  room.isOnline.value &&
                  room.myPlayerId.value &&
                  g.discussionDecisionVotes.value[room.myPlayerId.value] === 'sleep'
                    ? 'border-accent-coral bg-accent-coral/15 text-accent-coral'
                    : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-coral hover:text-accent-coral'
                "
                @click="
                  room.isOnline.value
                    ? submitDiscussionDecision('sleep')
                    : g.goSleepAfterDiscussion()
                "
              >
                <p class="font-display text-base font-bold">Đi ngủ</p>
                <p class="mt-1 text-xs">{{ g.discussionSleepVoteCount.value }} người chọn</p>
              </button>
            </div>
            <button
              class="w-full border border-border-default bg-bg-surface py-3 font-display text-sm font-semibold text-text-secondary transition hover:border-accent-amber hover:text-accent-amber"
              @click="g.togglePause"
            >
              {{ g.isPaused.value ? '▶ Tiếp tục' : '⏸ Tạm dừng' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ DAY NOMINATE ══ -->
      <div
        v-else-if="g.phase.value === 'day-nominate'"
        class="flex min-h-screen flex-col items-center justify-center px-4"
      >
        <div class="w-full max-w-sm">
          <div class="mb-4 text-center">
            <h2 class="font-display text-2xl font-bold">Bỏ phiếu đề cử</h2>
            <p
              v-if="g.currentNominatePlayer.value"
              class="mt-2 text-lg font-semibold text-accent-amber"
            >
              {{ g.currentNominatePlayer.value.name }}
              <span class="ml-2 text-sm text-text-dim"
                >({{ g.nominateCurrentIndex.value + 1 }}/{{ g.livingPlayers.value.length }})</span
              >
            </p>
          </div>

          <!-- Online: waiting for player's phone input -->
          <div
            v-if="room.isOnline.value"
            class="mb-4 border border-accent-amber/20 bg-bg-surface p-5 text-center"
          >
            <p class="text-sm text-text-dim">
              Chờ
              <span class="font-bold text-accent-amber">{{
                g.currentNominatePlayer.value?.name
              }}</span>
              đề cử xong.
            </p>
            <div class="mt-3 flex justify-center gap-1">
              <span
                v-for="n in 3"
                :key="n"
                class="size-1.5 animate-bounce rounded-full bg-accent-amber/40"
                :style="`animation-delay: ${(n - 1) * 200}ms`"
              />
            </div>
          </div>

          <!-- Offline: host clicks for each player -->
          <div v-else>
            <div class="mb-4 grid grid-cols-2 gap-2">
              <button
                v-for="p in g.livingPlayers.value.filter(
                  (pl) => pl.id !== g.currentNominatePlayer.value?.id,
                )"
                :key="p.id"
                class="border py-3 font-display text-sm transition"
                :class="
                  g.nominations.value[g.currentNominatePlayer.value?.id ?? ''] === p.id
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-coral/50'
                "
                @click="g.castNomination(p.id)"
              >
                {{ p.name }}
              </button>
            </div>
            <button
              class="w-full border border-border-default py-3 font-display text-sm text-text-secondary hover:border-accent-coral hover:text-accent-coral"
              @click="g.castNomination(null)"
            >
              Bỏ qua
            </button>
          </div>

          <!-- Nomination tally -->
          <div v-if="Object.values(g.nominations.value).some((v) => v)" class="mt-4 space-y-1">
            <p class="text-xs text-text-dim">Kết quả tạm:</p>
            <div v-for="(nomineeId, voterId) in g.nominations.value" :key="voterId">
              <div v-if="nomineeId" class="flex justify-between text-xs">
                <span class="text-text-dim">{{ getPlayerName(String(voterId)) }}</span>
                <span class="text-accent-coral">→ {{ getPlayerName(nomineeId) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ DAY EXPLAIN ══ -->
      <div
        v-else-if="g.phase.value === 'day-explain'"
        class="flex min-h-screen flex-col items-center justify-center px-4"
      >
        <div class="w-full max-w-sm">
          <div class="mb-6 text-center">
            <h2 class="font-display text-2xl font-bold">Giải thích</h2>
            <p
              v-if="g.currentExplainPlayer.value"
              class="mt-2 text-xl font-semibold text-accent-amber"
            >
              {{ g.currentExplainPlayer.value.name }}
            </p>
            <p class="mt-1 font-display text-4xl font-bold text-accent-coral">
              {{ g.explainTimeLeft.value }}s
            </p>
            <p class="mt-1 text-xs text-text-dim">
              {{ g.explainCurrentIndex.value + 1 }}/{{ g.nominatedPlayers.value.length }}
            </p>
          </div>
          <div class="flex gap-3">
            <button
              class="flex-1 border border-border-default py-3 font-display text-sm text-text-secondary hover:border-accent-amber hover:text-accent-amber"
              @click="g.togglePause"
            >
              {{ g.isPaused.value ? '▶' : '⏸' }}
            </button>
            <button
              class="flex-1 border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral"
              @click="g.nextExplain"
            >
              Tiếp theo
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ DAY HANG ══ -->
      <div
        v-else-if="g.phase.value === 'day-hang'"
        class="flex min-h-screen flex-col items-center justify-center px-4"
      >
        <div class="w-full max-w-sm">
          <div class="mb-4 text-center">
            <h2 class="font-display text-2xl font-bold">Bỏ phiếu treo cổ</h2>
            <div class="mt-2 flex flex-wrap justify-center gap-2">
              <span
                v-for="id in g.nominatedPlayers.value"
                :key="id"
                class="border border-accent-coral/50 bg-accent-coral/10 px-3 py-1 font-display text-sm font-bold text-accent-coral"
                >{{ getPlayerName(id) }}</span
              >
            </div>
            <p
              v-if="g.currentHangVotePlayer.value"
              class="mt-3 text-lg font-semibold text-accent-amber"
            >
              {{ g.currentHangVotePlayer.value.name }}
              <span class="ml-2 text-sm text-text-dim"
                >({{ g.hangVoteCurrentIndex.value + 1 }}/{{ g.livingPlayers.value.length }})</span
              >
            </p>
          </div>

          <!-- Online: waiting -->
          <div
            v-if="room.isOnline.value"
            class="mb-4 border border-accent-coral/20 bg-bg-surface p-5 text-center"
          >
            <p class="text-sm text-text-dim">
              Chờ
              <span class="font-bold text-accent-amber">{{
                g.currentHangVotePlayer.value?.name
              }}</span>
              bỏ phiếu xong.
            </p>
          </div>

          <!-- Offline -->
          <div v-else>
            <div class="mb-4 grid grid-cols-2 gap-2">
              <button
                v-for="id in g.nominatedPlayers.value"
                :key="id"
                class="border py-3 font-display text-sm transition"
                :class="
                  g.hangVotes.value[g.currentHangVotePlayer.value?.id ?? ''] === id
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default bg-bg-elevated text-text-secondary hover:border-accent-coral/50'
                "
                @click="g.castHangVote(id)"
              >
                {{ getPlayerName(id) }}
              </button>
            </div>
            <button
              class="w-full border border-border-default py-3 font-display text-sm text-text-secondary hover:border-accent-coral hover:text-accent-coral"
              @click="g.castHangVote(null)"
            >
              Bỏ phiếu trắng
            </button>
          </div>

          <!-- Tally -->
          <div v-if="Object.values(g.hangVotes.value).some((v) => v)" class="mt-4 space-y-1">
            <p class="text-xs text-text-dim">Kết quả tạm:</p>
            <div v-for="(targetId, voterId) in g.hangVotes.value" :key="voterId">
              <div v-if="targetId" class="flex justify-between text-xs">
                <span class="text-text-dim">{{ getPlayerName(String(voterId)) }}</span>
                <span class="text-accent-coral">→ {{ getPlayerName(targetId) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ GAME OVER ══ -->
      <div
        v-else-if="g.phase.value === 'game-over'"
        class="flex min-h-screen flex-col items-center justify-center px-4"
      >
        <div class="w-full max-w-sm text-center">
          <div class="mb-4 text-6xl">{{ g.winnerFaction.value === 'wolf' ? '🐺' : '🏆' }}</div>
          <h2
            class="mb-2 font-display text-3xl font-bold"
            :class="g.winnerFaction.value === 'wolf' ? 'text-accent-coral' : 'text-accent-sky'"
          >
            {{ g.winnerFaction.value === 'wolf' ? 'Phe Sói thắng!' : 'Phe Dân thắng!' }}
          </h2>
          <p class="mb-8 text-sm text-text-secondary">
            Trò chơi kết thúc sau {{ g.roundNumber.value }} vòng
          </p>

          <!-- Final player roster -->
          <div class="mb-6 space-y-2 text-left">
            <div
              v-for="p in g.players.value"
              :key="p.id"
              class="flex items-center justify-between border border-border-default bg-bg-surface px-4 py-2.5"
            >
              <div class="flex items-center gap-2">
                <span>{{ ROLE_EMOJI[p.role] }}</span>
                <span :class="p.alive ? 'text-text-primary' : 'line-through text-text-dim'">{{
                  p.name
                }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span :class="p.faction === 'wolf' ? 'text-accent-coral' : 'text-accent-sky'">{{
                  ROLE_NAMES[p.role]
                }}</span>
                <span v-if="!p.alive" class="text-text-dim"
                  >✝ {{ p.deathRound }}{{ p.deathTime === 'night' ? '🌙' : '☀️' }}</span
                >
              </div>
            </div>
          </div>

          <button
            class="w-full border border-accent-coral bg-accent-coral/10 py-4 font-display text-lg font-bold text-accent-coral transition hover:bg-accent-coral/20"
            @click="handleReset"
          >
            Chơi lại
          </button>
        </div>
      </div>
    </template>

    <div v-if="isHostOnlineGame" class="fixed bottom-4 left-4 z-40 flex flex-wrap gap-2">
      <button
        class="flex size-11 items-center justify-center border border-border-default bg-bg-surface text-text-secondary shadow-[0_12px_32px_rgba(0,0,0,0.28)] transition hover:border-accent-amber hover:text-accent-amber"
        title="Người chơi"
        @click="showPlayersPopover = true"
      >
        <Icon icon="lucide:users" class="size-4.5" />
      </button>
      <button
        v-if="room.myRole.value"
        class="flex items-center gap-2 border border-accent-amber/30 bg-bg-surface px-3 py-2 text-sm text-text-primary shadow-[0_12px_32px_rgba(0,0,0,0.28)] transition hover:border-accent-coral hover:text-accent-coral"
        title="Vai của tôi"
        @click="showSelfPanel = true"
      >
        <span>{{ ROLE_EMOJI[room.myRole.value] }}</span>
        <span class="font-display font-semibold">Vai của tôi</span>
      </button>
    </div>

    <div
      v-if="showPlayersPopover && (room.publicPlayers.value.length > 0 || onlinePlayers.length > 0)"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      @click.self="showPlayersPopover = false"
    >
      <div class="w-full max-w-sm border border-border-default bg-bg-surface p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="font-display text-lg font-bold">Người chơi</p>
            <p class="text-xs text-text-dim">
              {{
                room.publicPlayers.value.length > 0
                  ? `${onlineAlivePlayerCount}/${room.publicPlayers.value.length} còn sống`
                  : `${onlinePlayerCount}/${onlineJoinedPlayerCount} đang kết nối`
              }}
            </p>
          </div>
          <button class="text-text-dim hover:text-accent-coral" @click="showPlayersPopover = false">
            <Icon icon="lucide:x" class="size-4" />
          </button>
        </div>

        <div v-if="room.publicPlayers.value.length > 0" class="space-y-2">
          <div
            v-for="p in room.publicPlayers.value"
            :key="p.id"
            class="flex items-center justify-between border border-border-default px-4 py-2.5 text-sm"
            :class="
              p.alive ? 'bg-bg-elevated text-text-primary' : 'bg-bg-deep text-text-dim line-through'
            "
          >
            <div class="flex items-center gap-2">
              <span>{{ p.name }}</span>
              <span v-if="p.id === room.myPlayerId.value" class="text-xs text-accent-coral"
                >(bạn)</span
              >
              <span
                v-else-if="myRoomPlayer?.id === p.id && myRoomPlayer.isHost"
                class="text-xs text-accent-amber"
                >(máy chính)</span
              >
            </div>
            <span v-if="p.isSilenced && p.alive" class="text-xs text-accent-amber">🤫</span>
          </div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="p in onlinePlayers"
            :key="p.id"
            class="flex items-center justify-between border border-border-default bg-bg-elevated px-4 py-2.5 text-sm"
          >
            <div class="flex items-center gap-2">
              <span
                class="size-2 rounded-full"
                :class="p.connected ? 'bg-accent-sky' : 'bg-border-default'"
              />
              <span>{{ p.name }}</span>
              <span v-if="p.id === room.myPlayerId.value" class="text-xs text-accent-coral"
                >(bạn)</span
              >
              <span v-else-if="p.isHost" class="text-xs text-accent-amber">(máy chính)</span>
            </div>
            <span class="text-xs text-text-dim">{{ p.connected ? 'Đã vào' : 'Chưa kết nối' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showSelfPanel && room.isOnline.value && room.isHost.value && room.myRole.value"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      @click.self="showSelfPanel = false"
    >
      <div class="w-full max-w-sm border border-border-default bg-bg-surface p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="font-display text-lg font-bold">Vai của tôi</p>
            <p class="text-xs text-text-dim">Máy chính vẫn là một người chơi bình thường</p>
          </div>
          <button class="text-text-dim hover:text-accent-coral" @click="showSelfPanel = false">
            <Icon icon="lucide:x" class="size-4" />
          </button>
        </div>

        <div
          class="mb-4 border p-4"
          :class="
            room.myFaction.value === 'wolf'
              ? 'border-accent-coral/30 bg-accent-coral/5'
              : 'border-accent-sky/30 bg-accent-sky/5'
          "
        >
          <div class="flex items-center gap-3">
            <span class="text-3xl">{{ ROLE_EMOJI[room.myRole.value] }}</span>
            <div>
              <p class="font-display text-lg font-bold">{{ ROLE_NAMES[room.myRole.value] }}</p>
              <p
                class="text-xs font-semibold"
                :class="room.myFaction.value === 'wolf' ? 'text-accent-coral' : 'text-accent-sky'"
              >
                {{ room.myFaction.value === 'wolf' ? 'Phe Sói' : 'Phe Dân' }}
              </p>
              <p class="mt-1 text-xs text-text-dim">{{ ROLE_DESC[room.myRole.value] }}</p>
            </div>
          </div>
        </div>

        <div
          v-if="playerSubmittedMessage"
          class="mb-4 border border-accent-sky/30 bg-accent-sky/10 p-4 text-sm text-text-secondary"
        >
          <p class="font-semibold text-accent-sky">Đã gửi thao tác</p>
          <p class="mt-1">{{ playerSubmittedMessage }} Chờ vòng tiếp theo.</p>
        </div>

        <div
          v-else-if="playerTurnInstruction"
          class="mb-4 border p-4"
          :class="
            playerTurnInstruction.tone === 'warning'
              ? 'border-accent-amber/30 bg-accent-amber/10'
              : 'border-accent-coral/30 bg-accent-coral/10'
          "
        >
          <div
            class="flex items-center gap-2 text-sm font-semibold"
            :class="
              playerTurnInstruction.tone === 'warning' ? 'text-accent-amber' : 'text-accent-coral'
            "
          >
            <Icon :icon="playerTurnInstruction.icon" class="size-4" />
            <span>{{ playerTurnInstruction.title }}</span>
          </div>
          <p class="mt-2 text-sm text-text-secondary">{{ playerTurnInstruction.detail }}</p>
        </div>

        <div
          v-else
          class="mb-4 border border-accent-amber/20 bg-bg-elevated p-4 text-sm text-text-secondary"
        >
          {{ playerWaitingState.detail }}
        </div>

        <div v-if="room.isMyTurnToAct.value && room.serverPhase.value === 'night'" class="mb-4">
          <div
            v-if="
              room.myActionStep.value &&
              ['disruptor', 'seer', 'guard', 'hunter', 'wolves'].includes(room.myActionStep.value)
            "
            class="border border-accent-coral/30 bg-bg-elevated p-4"
          >
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="p in room.publicPlayers.value.filter(
                  (pl) =>
                    pl.alive &&
                    (room.myActionStep.value === 'guard' || pl.id !== room.myPlayerId.value),
                )"
                :key="p.id"
                class="border py-3 font-display text-sm transition"
                :class="
                  p.id === selectedTarget
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default bg-bg-surface text-text-secondary hover:border-accent-coral/50'
                "
                @click="selectActionTarget(p.id)"
              >
                {{ p.name }}
              </button>
            </div>
            <button
              class="mt-4 w-full border border-accent-coral bg-accent-coral/10 py-3 font-display text-sm font-semibold text-accent-coral disabled:opacity-40"
              :disabled="!selectedTarget"
              @click="submitSingleTargetNightAction"
            >
              Xác nhận
            </button>
          </div>

          <div
            v-else-if="room.myActionStep.value === 'witch'"
            class="border border-accent-amber/30 bg-bg-elevated p-4"
          >
            <p v-if="room.myActionExtra.value.victimName" class="mb-3 text-sm text-text-secondary">
              Đêm nay
              <span class="font-bold text-accent-coral">{{
                room.myActionExtra.value.victimName
              }}</span>
              bị cắn.
            </p>
            <div class="mb-3 flex gap-2">
              <button
                v-if="room.myActionExtra.value.canSave"
                class="flex-1 border py-2 font-display text-sm transition"
                :class="
                  witchChoice === 'save'
                    ? 'border-accent-sky bg-accent-sky/20 text-accent-sky'
                    : 'border-border-default text-text-secondary hover:border-accent-sky/50'
                "
                @click="witchChoice = witchChoice === 'save' ? 'none' : 'save'"
              >
                Cứu
              </button>
              <button
                v-if="room.myActionExtra.value.canKill"
                class="flex-1 border py-2 font-display text-sm transition"
                :class="
                  witchChoice === 'kill'
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default text-text-secondary hover:border-accent-coral/50'
                "
                @click="witchChoice = witchChoice === 'kill' ? 'none' : 'kill'"
              >
                Độc
              </button>
            </div>
            <div v-if="witchChoice === 'kill'" class="mb-3 grid grid-cols-2 gap-2">
              <button
                v-for="p in room.publicPlayers.value.filter((pl) => pl.alive)"
                :key="p.id"
                class="border py-2 text-sm transition"
                :class="
                  witchKillTarget === p.id
                    ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                    : 'border-border-default text-text-secondary hover:border-accent-coral/50'
                "
                @click="selectWitchKillTarget(p.id)"
              >
                {{ p.name }}
              </button>
            </div>
            <button
              class="w-full border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber"
              @click="submitWitchAction"
            >
              {{ witchChoice === 'none' ? 'Bỏ qua' : 'Xác nhận' }}
            </button>
          </div>

          <div
            v-else-if="room.myActionStep.value === 'cupid'"
            class="border border-accent-amber/30 bg-bg-elevated p-4"
          >
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="p in room.publicPlayers.value.filter((pl) => pl.alive)"
                :key="p.id"
                class="border py-3 font-display text-sm transition"
                :class="
                  cupidChoice1 === p.id || cupidChoice2 === p.id
                    ? 'border-accent-amber bg-accent-amber/20 text-accent-amber'
                    : 'border-border-default text-text-secondary hover:border-accent-amber/50'
                "
                @click="handleCupidPlayerClick(p.id)"
              >
                {{ p.name }}
              </button>
            </div>
            <button
              class="mt-4 w-full border border-accent-amber bg-accent-amber/10 py-3 font-display text-sm font-semibold text-accent-amber disabled:opacity-40"
              :disabled="!cupidChoice1 || !cupidChoice2"
              @click="submitCupidAction"
            >
              Xác nhận
            </button>
          </div>
        </div>

        <div
          v-if="room.isMyTurnToAct.value && room.myActionExtra.value?.type === 'nomination'"
          class="mb-4 border border-accent-amber/30 bg-bg-elevated p-4"
        >
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="p in room.publicPlayers.value.filter(
                (pl) => pl.alive && pl.id !== room.myPlayerId.value,
              )"
              :key="p.id"
              class="border py-3 text-sm transition"
              :class="
                selectedTarget === p.id
                  ? 'border-accent-amber bg-accent-amber/20 text-accent-amber'
                  : 'border-border-default text-text-secondary hover:border-accent-amber/50'
              "
              @click="selectActionTarget(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              class="flex-1 border border-border-default py-2 text-sm text-text-dim hover:border-accent-coral hover:text-accent-coral"
              @click="skipNomination"
            >
              Bỏ qua
            </button>
            <button
              class="flex-1 border border-accent-amber bg-accent-amber/10 py-2 font-display text-sm font-semibold text-accent-amber disabled:opacity-40"
              :disabled="!selectedTarget"
              @click="submitNomination"
            >
              Đề cử
            </button>
          </div>
        </div>

        <div
          v-if="room.isMyTurnToAct.value && room.myActionExtra.value?.type === 'hang_vote'"
          class="mb-4 border border-accent-coral/30 bg-bg-elevated p-4"
        >
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="nomineeId in room.myActionExtra.value.nominees as string[]"
              :key="nomineeId"
              class="border py-3 text-sm transition"
              :class="
                selectedTarget === nomineeId
                  ? 'border-accent-coral bg-accent-coral/20 text-accent-coral'
                  : 'border-border-default text-text-secondary hover:border-accent-coral/50'
              "
              @click="selectActionTarget(nomineeId)"
            >
              {{ getPublicPlayerName(nomineeId) }}
            </button>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              class="flex-1 border border-border-default py-2 text-sm text-text-dim hover:border-accent-coral hover:text-accent-coral"
              @click="skipHangVote"
            >
              Trắng
            </button>
            <button
              class="flex-1 border border-accent-coral bg-accent-coral/10 py-2 font-display text-sm font-semibold text-accent-coral disabled:opacity-40"
              :disabled="!selectedTarget"
              @click="submitHangVote"
            >
              Bầu
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ PAUSE OVERLAY ══ -->
    <div
      v-if="g.isPaused.value && g.phase.value !== 'setup'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div class="border border-accent-amber bg-bg-surface p-8 text-center">
        <p class="mb-4 font-display text-xl font-bold text-accent-amber">⏸ Đã tạm dừng</p>
        <p v-if="disconnectPauseActive" class="mb-4 max-w-sm text-sm text-text-secondary">
          Đang chờ
          <span class="font-semibold text-accent-coral">
            {{ disconnectedOnlinePlayers.map((player) => player.name).join(', ') }}
          </span>
          quay lại phòng để tiếp tục ván chơi.
        </p>
        <button
          v-if="!disconnectPauseActive"
          class="border border-accent-amber bg-accent-amber/10 px-6 py-3 font-display font-semibold text-accent-amber"
          @click="g.togglePause"
        >
          ▶ Tiếp tục
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ RESET CONFIRM ══ -->
    <div
      v-if="showResetConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div class="mx-4 w-full max-w-sm border border-accent-coral bg-bg-surface p-6 text-center">
        <p class="mb-4 font-display text-lg font-bold">Kết thúc game?</p>
        <p class="mb-6 text-sm text-text-secondary">Mọi dữ liệu game hiện tại sẽ bị xóa.</p>
        <div class="flex gap-3">
          <button
            class="flex-1 border border-border-default py-3 text-sm text-text-secondary hover:border-accent-coral hover:text-accent-coral"
            @click="showResetConfirm = false"
          >
            Hủy
          </button>
          <button
            class="flex-1 border border-accent-coral bg-accent-coral/10 py-3 font-display font-semibold text-accent-coral"
            @click="handleReset"
          >
            Kết thúc
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ SPEECH SETTINGS ══ -->
    <div
      v-if="showSpeechSettings"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      @click.self="showSpeechSettings = false"
    >
      <div class="mx-4 w-full max-w-sm border border-border-default bg-bg-surface p-6">
        <div class="mb-4 flex items-center justify-between">
          <p class="font-display text-lg font-bold">Cài đặt giọng đọc</p>
          <button class="text-text-dim hover:text-accent-coral" @click="showSpeechSettings = false">
            <Icon icon="lucide:x" class="size-4" />
          </button>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-xs text-text-dim">Tốc độ đọc</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            v-model.number="g.speechRate.value"
            class="w-full"
          />
          <p class="text-right text-xs text-text-dim">{{ g.speechRate.value.toFixed(2) }}x</p>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-xs text-text-dim">Giọng đọc</label>
          <select
            v-model="g.selectedVoiceURI.value"
            class="w-full border border-border-default bg-bg-deep px-3 py-2 text-sm focus:border-accent-coral focus:outline-none"
          >
            <option value="">-- Mặc định --</option>
            <optgroup v-if="viVoices.length" label="Tiếng Việt">
              <option v-for="v in viVoices" :key="v.voiceURI" :value="v.voiceURI">
                {{ v.name }}
              </option>
            </optgroup>
          </select>
        </div>
        <button
          class="w-full border border-accent-amber bg-accent-amber/10 py-2 font-display text-sm font-semibold text-accent-amber"
          @click="g.testSpeak"
        >
          Test giọng đọc
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ GUIDE ══ -->
    <div
      v-if="showGuide"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      @click.self="showGuide = false"
    >
      <div
        class="max-h-[80vh] w-full max-w-sm overflow-y-auto border border-border-default bg-bg-surface p-6"
      >
        <div class="mb-4 flex items-center justify-between">
          <p class="font-display text-lg font-bold">Hướng dẫn nhanh</p>
          <button @click="showGuide = false">
            <Icon icon="lucide:x" class="size-4 text-text-dim hover:text-accent-coral" />
          </button>
        </div>
        <div class="space-y-4 text-sm text-text-secondary">
          <div>
            <p class="font-bold text-text-primary mb-1">Chế độ chơi</p>
            <p>
              <span class="text-accent-coral font-semibold">Offline:</span> Mọi người dùng chung 1
              điện thoại. Máy chính lần lượt cho từng người xem bài rồi xác nhận.
            </p>
            <p class="mt-1">
              <span class="text-accent-amber font-semibold">Online:</span> Mỗi người dùng điện thoại
              riêng. Máy chính tạo phòng và phát loa. Vai được gửi riêng cho từng người. Đêm/ngày ai
              tới lượt thì thao tác trên máy của mình.
            </p>
          </div>
          <div v-for="r in CONFIGURABLE_ROLES" :key="r.id">
            <p class="font-semibold text-text-primary">
              {{ ROLE_EMOJI[r.id] }} {{ ROLE_NAMES[r.id] }}
            </p>
            <p class="text-xs">{{ ROLE_DESC[r.id] }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ FLOATING RESET (in-game) ══ -->
    <button
      v-if="g.phase.value !== 'setup' && room.mode.value !== 'player'"
      class="fixed right-4 top-4 z-40 border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-dim hover:border-accent-coral hover:text-accent-coral"
      @click="showResetConfirm = true"
    >
      <Icon icon="lucide:x" class="inline size-3.5" /> Kết thúc
    </button>
  </div>
</template>
