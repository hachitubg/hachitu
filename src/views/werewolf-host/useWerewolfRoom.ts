import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { io, type Socket } from 'socket.io-client'
import type { DeathRecord, Faction, GamePhase, NightStep, NightUiState, RoleId } from './types'

export interface WwRoomPlayer {
  id: string
  name: string
  connected: boolean
  isHost: boolean
}

export interface PublicPlayer {
  id: string
  name: string
  alive: boolean
  isSilenced: boolean
}

export interface IncomingAction {
  fromPlayerId: string
  action: string
  payload: Record<string, unknown>
}

export interface SavedWerewolfSession {
  mode: Exclude<WwMode, 'offline'>
  roomId: string
  playerId: string
  sessionId: string
  displayName: string
}

export type WwMode = 'offline' | 'host' | 'player'
export type WwStatus = 'idle' | 'creating' | 'joining' | 'waiting' | 'playing'

export function useWerewolfRoom() {
  const mode = ref<WwMode>('offline')
  const status = ref<WwStatus>('idle')
  const roomId = ref<string | null>(null)
  const myPlayerId = ref<string | null>(null)
  const mySessionId = ref<string | null>(null)
  const myDisplayName = ref('')
  const roomPlayers = ref<WwRoomPlayer[]>([])
  const socket = ref<Socket | null>(null)
  const errorMsg = ref('')
  const savedSession = useLocalStorage<SavedWerewolfSession | null>('ww:session', null)
  const manualDisconnect = ref(false)

  // Player-side received state
  const myRole = ref<RoleId | null>(null)
  const myFaction = ref<Faction | null>(null)
  const serverPhase = ref<GamePhase>('setup')
  const serverNightStep = ref<NightStep | null>(null)
  const serverNightUiState = ref<NightUiState>('calling')
  const serverNightActionTimeLeft = ref(0)
  const serverRound = ref(1)
  const isMyTurnToAct = ref(false)
  const myActionStep = ref<NightStep | null>(null)
  const myActionExtra = ref<Record<string, unknown>>({})
  const publicPlayers = ref<PublicPlayer[]>([])
  const gameOverWinner = ref<'wolf' | 'villager' | null>(null)
  const nominatedNames = ref<string[]>([])
  const serverDayDeaths = ref<DeathRecord[]>([])
  const serverNightSilenced = ref<string | null>(null)
  const serverDiscussionStage = ref<'talking' | 'decision'>('talking')
  const serverDiscussionTimeLeft = ref(0)
  const serverDiscussionDecisionTimeLeft = ref(0)
  const serverDiscussionSkipVotes = ref<string[]>([])
  const serverDiscussionDecisionVotes = ref<Record<string, 'extend' | 'sleep'>>({})

  // Host receives player actions via this queue
  const pendingActions = ref<IncomingAction[]>([])

  const isHost = computed(() => mode.value === 'host')
  const isOnline = computed(() => mode.value !== 'offline')
  const connectedCount = computed(() => roomPlayers.value.filter((p) => p.connected).length)

  function persistSession(session: SavedWerewolfSession) {
    savedSession.value = session
    roomId.value = session.roomId
    myPlayerId.value = session.playerId
    mySessionId.value = session.sessionId
    myDisplayName.value = session.displayName
    mode.value = session.mode
  }

  function clearSavedSession() {
    savedSession.value = null
  }

  function resetDiscussionState() {
    serverDiscussionStage.value = 'talking'
    serverDiscussionTimeLeft.value = 0
    serverDiscussionDecisionTimeLeft.value = 0
    serverDiscussionSkipVotes.value = []
    serverDiscussionDecisionVotes.value = {}
  }

  // ── Room management ──────────────────────────────────────────────────────────

  async function createRoom(displayName: string) {
    myDisplayName.value = displayName
    mode.value = 'host'
    status.value = 'creating'
    errorMsg.value = ''
    try {
      const res = await fetch('/api/game/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameType: 'werewolf', displayName }),
      })
      if (!res.ok) throw new Error('Không thể tạo phòng')
      const data = (await res.json()) as {
        roomId: string
        hostPlayerId: string
        hostSessionId: string
      }
      persistSession({
        mode: 'host',
        roomId: data.roomId,
        playerId: data.hostPlayerId,
        sessionId: data.hostSessionId,
        displayName,
      })
      connectSocket(data.roomId, data.hostPlayerId, data.hostSessionId, displayName)
    } catch (e: unknown) {
      errorMsg.value = (e as Error).message
      status.value = 'idle'
      mode.value = 'offline'
    }
  }

  async function joinRoom(code: string, displayName: string) {
    myDisplayName.value = displayName
    mode.value = 'player'
    status.value = 'joining'
    errorMsg.value = ''
    try {
      const id = code.toUpperCase().trim()
      const res = await fetch(`/api/game/rooms/${id}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })
      if (!res.ok) throw new Error((await res.text()) || 'Không thể vào phòng')
      const data = (await res.json()) as { roomId: string; playerId: string; sessionId: string }
      persistSession({
        mode: 'player',
        roomId: data.roomId,
        playerId: data.playerId,
        sessionId: data.sessionId,
        displayName,
      })
      connectSocket(data.roomId, data.playerId, data.sessionId, displayName)
    } catch (e: unknown) {
      errorMsg.value = (e as Error).message
      status.value = 'idle'
      mode.value = 'offline'
    }
  }

  async function resumeSavedSession() {
    const session = savedSession.value
    if (!session) return

    mode.value = session.mode
    status.value = 'joining'
    errorMsg.value = ''
    persistSession(session)
    connectSocket(session.roomId, session.playerId, session.sessionId, session.displayName)
  }

  function connectSocket(id: string, playerId: string, sessionId: string, displayName: string) {
    manualDisconnect.value = true
    socket.value?.disconnect()
    manualDisconnect.value = false
    const s = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket'],
      query: { gameType: 'werewolf', roomId: id, playerId, sessionId, displayName },
    })
    socket.value = s

    s.on('game:event', (msg: Record<string, unknown>) => {
      if (msg.type === 'room_state') {
        const roomState = msg.room as { players: unknown[]; currentPhase?: GamePhase }
        syncRoomPlayers(roomState.players)
        status.value =
          roomState.currentPhase && roomState.currentPhase !== 'setup' ? 'playing' : 'waiting'
      } else if (msg.type === 'players_updated') {
        syncRoomPlayers(msg.players as unknown[])
      } else if (msg.type === 'action') {
        handleBroadcastAction(
          String(msg.fromPlayerId ?? ''),
          String(msg.action ?? ''),
          (msg.payload ?? {}) as Record<string, unknown>,
        )
      } else if (msg.type === 'directed_message') {
        handleDirectedMessage(
          String(msg.action ?? ''),
          (msg.payload ?? {}) as Record<string, unknown>,
        )
      } else if (msg.type === 'error') {
        errorMsg.value = String(msg.reason ?? 'Lỗi kết nối')
        status.value = 'idle'
        mode.value = 'offline'
        clearSavedSession()
      }
    })

    s.on('connect', () => {
      errorMsg.value = ''
    })

    s.on('disconnect', () => {
      socket.value = null
      if (manualDisconnect.value) return
      errorMsg.value = 'Đã mất kết nối. Bạn có thể quay lại phòng đang chơi.'
    })

    s.on('connect_error', () => {
      errorMsg.value = 'Không kết nối được server'
      if (!savedSession.value) {
        status.value = 'idle'
      }
    })
  }

  function syncRoomPlayers(raw: unknown[]) {
    roomPlayers.value = (raw ?? []).map((p) => {
      const player = p as Record<string, unknown>
      return {
        id: String(player.playerId ?? player.id ?? ''),
        name: String(player.displayName ?? player.name ?? 'Player'),
        connected: Boolean(player.connected),
        isHost: Boolean(player.isHost),
      }
    })
  }

  function handleBroadcastAction(
    fromPlayerId: string,
    action: string,
    payload: Record<string, unknown>,
  ) {
    if (action === 'ww_phase') {
      const nextPhase = payload.phase as GamePhase
      const nextNightStep = (payload.nightStep as NightStep) || null
      const nextNightUiState = (payload.nightUiState as NightUiState) || 'calling'
      const currentActionType = String(myActionExtra.value.type ?? '')
      const shouldResetNightAction =
        nextPhase !== 'night' ||
        (myActionStep.value !== null && nextNightStep !== myActionStep.value)
      const shouldResetNominationAction =
        currentActionType === 'nomination' && nextPhase !== 'day-nominate'
      const shouldResetHangVoteAction =
        currentActionType === 'hang_vote' && nextPhase !== 'day-hang'
      const shouldResetAction =
        shouldResetNightAction || shouldResetNominationAction || shouldResetHangVoteAction

      if (shouldResetAction) {
        isMyTurnToAct.value = false
        myActionStep.value = null
        myActionExtra.value = {}
      }

      if (nextPhase !== 'day-result') {
        serverDayDeaths.value = []
        serverNightSilenced.value = null
      }

      if (nextPhase !== 'day-discussion') {
        resetDiscussionState()
      }

      serverPhase.value = nextPhase
      serverNightStep.value = nextNightStep
      serverNightUiState.value = nextNightUiState
      serverNightActionTimeLeft.value = Number(payload.actionTimeLeft) || 0
      serverRound.value = Number(payload.round) || serverRound.value
      if (serverPhase.value !== 'setup') status.value = 'playing'
    } else if (action === 'ww_players') {
      publicPlayers.value = payload.players as PublicPlayer[]
    } else if (action === 'ww_nominated') {
      nominatedNames.value = payload.names as string[]
    } else if (action === 'ww_day_result') {
      serverDayDeaths.value = (payload.deaths as DeathRecord[]) ?? []
      serverNightSilenced.value = (payload.silenced as string | null) ?? null
    } else if (action === 'ww_discussion_state') {
      serverDiscussionStage.value =
        (payload.stage as 'talking' | 'decision') === 'decision' ? 'decision' : 'talking'
      serverDiscussionTimeLeft.value = Number(payload.timeLeft) || 0
      serverDiscussionDecisionTimeLeft.value = Number(payload.decisionTimeLeft) || 0
      serverDiscussionSkipVotes.value = ((payload.skipVotes as string[]) ?? []).filter(Boolean)
      serverDiscussionDecisionVotes.value =
        (payload.decisionVotes as Record<string, 'extend' | 'sleep'>) ?? {}
    } else if (action === 'ww_game_over') {
      gameOverWinner.value = payload.winner as 'wolf' | 'villager'
      serverPhase.value = 'game-over'
    } else if (
      mode.value === 'host' &&
      [
        'ww_night_action',
        'ww_nomination',
        'ww_hang_vote',
        'ww_discussion_skip',
        'ww_discussion_decision',
      ].includes(action)
    ) {
      pendingActions.value.push({ fromPlayerId, action, payload })
    }
  }

  function handleDirectedMessage(action: string, payload: Record<string, unknown>) {
    if (action === 'ww_role') {
      myRole.value = payload.roleId as RoleId
      myFaction.value = payload.faction as Faction
      serverPhase.value = 'role-reveal'
      status.value = 'playing'
    } else if (action === 'ww_request_action') {
      isMyTurnToAct.value = true
      myActionStep.value = payload.step as NightStep
      myActionExtra.value = payload
      status.value = 'playing'
    } else if (action === 'ww_request_nomination') {
      isMyTurnToAct.value = true
      myActionStep.value = null
      myActionExtra.value = { type: 'nomination' }
      status.value = 'playing'
    } else if (action === 'ww_request_hang_vote') {
      isMyTurnToAct.value = true
      myActionStep.value = null
      myActionExtra.value = { type: 'hang_vote', nominees: payload.nominees }
      status.value = 'playing'
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function broadcast(action: string, payload: Record<string, unknown>) {
    socket.value?.emit('game:client', { type: 'broadcast', action, payload })
  }

  function directed(toPlayerId: string, action: string, payload: Record<string, unknown>) {
    socket.value?.emit('game:client', { type: 'directed', toPlayerId, action, payload })
  }

  // ── Host broadcast ───────────────────────────────────────────────────────────

  function broadcastPhase(
    phase: GamePhase,
    nightStep?: NightStep | null,
    round?: number,
    nightUiState?: NightUiState,
    actionTimeLeft?: number,
  ) {
    broadcast('ww_phase', {
      phase,
      nightStep: nightStep ?? null,
      round: round ?? 1,
      nightUiState: nightUiState ?? 'calling',
      actionTimeLeft: actionTimeLeft ?? 0,
    })
  }

  function broadcastPlayers(players: PublicPlayer[]) {
    broadcast('ww_players', { players })
  }

  function broadcastNominated(names: string[]) {
    broadcast('ww_nominated', { names })
  }

  function broadcastDayResult(deaths: DeathRecord[], silenced: string | null) {
    broadcast('ww_day_result', { deaths, silenced })
  }

  function broadcastDiscussionState(
    stage: 'talking' | 'decision',
    timeLeft: number,
    decisionTimeLeft: number,
    skipVotes: string[],
    decisionVotes: Record<string, 'extend' | 'sleep'>,
  ) {
    broadcast('ww_discussion_state', {
      stage,
      timeLeft,
      decisionTimeLeft,
      skipVotes,
      decisionVotes,
    })
  }

  function broadcastGameOver(winner: 'wolf' | 'villager') {
    broadcast('ww_game_over', { winner })
  }

  function sendRoleToPlayer(toPlayerId: string, roleId: RoleId, faction: Faction) {
    directed(toPlayerId, 'ww_role', { roleId, faction })
  }

  function requestNightAction(
    toPlayerId: string,
    step: NightStep,
    extra: Record<string, unknown> = {},
  ) {
    directed(toPlayerId, 'ww_request_action', { step, ...extra })
  }

  function requestNomination(toPlayerId: string) {
    directed(toPlayerId, 'ww_request_nomination', {})
  }

  function requestHangVote(toPlayerId: string, nominees: string[]) {
    directed(toPlayerId, 'ww_request_hang_vote', { nominees })
  }

  // ── Player submit ────────────────────────────────────────────────────────────

  function submitNightAction(
    step: NightStep,
    targetId: string,
    extra: Record<string, unknown> = {},
  ) {
    broadcast('ww_night_action', { step, targetId, ...extra })
    isMyTurnToAct.value = false
  }

  function submitNomination(nomineeId: string | null) {
    broadcast('ww_nomination', { nomineeId })
    isMyTurnToAct.value = false
  }

  function submitHangVote(targetId: string | null) {
    broadcast('ww_hang_vote', { targetId })
    isMyTurnToAct.value = false
  }

  function submitDiscussionSkip() {
    broadcast('ww_discussion_skip', {})
  }

  function submitDiscussionDecision(decision: 'extend' | 'sleep') {
    broadcast('ww_discussion_decision', { decision })
  }

  function leaveRoom() {
    manualDisconnect.value = true
    socket.value?.disconnect()
    socket.value = null
    roomId.value = null
    myPlayerId.value = null
    mySessionId.value = null
    roomPlayers.value = []
    status.value = 'idle'
    mode.value = 'offline'
    myRole.value = null
    myFaction.value = null
    serverPhase.value = 'setup'
    serverNightStep.value = null
    serverNightUiState.value = 'calling'
    serverNightActionTimeLeft.value = 0
    isMyTurnToAct.value = false
    pendingActions.value = []
    gameOverWinner.value = null
    serverDayDeaths.value = []
    serverNightSilenced.value = null
    resetDiscussionState()
    errorMsg.value = ''
    clearSavedSession()
  }

  return {
    mode,
    status,
    roomId,
    myPlayerId,
    mySessionId,
    myDisplayName,
    roomPlayers,
    errorMsg,
    savedSession,
    isHost,
    isOnline,
    connectedCount,
    myRole,
    myFaction,
    serverPhase,
    serverNightStep,
    serverNightUiState,
    serverNightActionTimeLeft,
    serverRound,
    isMyTurnToAct,
    myActionStep,
    myActionExtra,
    publicPlayers,
    gameOverWinner,
    nominatedNames,
    serverDayDeaths,
    serverNightSilenced,
    serverDiscussionStage,
    serverDiscussionTimeLeft,
    serverDiscussionDecisionTimeLeft,
    serverDiscussionSkipVotes,
    serverDiscussionDecisionVotes,
    pendingActions,
    createRoom,
    joinRoom,
    resumeSavedSession,
    leaveRoom,
    broadcastPhase,
    broadcastPlayers,
    broadcastNominated,
    broadcastDayResult,
    broadcastDiscussionState,
    broadcastGameOver,
    sendRoleToPlayer,
    requestNightAction,
    requestNomination,
    requestHangVote,
    submitNightAction,
    submitNomination,
    submitHangVote,
    submitDiscussionSkip,
    submitDiscussionDecision,
  }
}

export type WerewolfRoomContext = ReturnType<typeof useWerewolfRoom>
