import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { Match, Participant, Tournament, TournamentFormat, TournamentView } from '../types'
import {
  advanceWinner,
  clearDownstreamMatches,
  generateDoubleEliminationMatches,
  generateSingleEliminationMatches,
} from './useBracket'
import {
  autoGroupCount,
  generateGroups,
  getAdvancingParticipants,
  isGroupStageComplete,
  recalcStandings,
} from './useGroupStage'
import { calcRoundRobinStandings, generateRoundRobinMatches } from './useRoundRobin'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const MOSCONI_PLAYERS_PER_TEAM = 5
const MOSCONI_TOTAL_GAMES = 20

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index] as T
    next[index] = next[swapIndex] as T
    next[swapIndex] = current
  }
  return next
}

function getTeamParticipants(participants: Participant[], teamId: 'A' | 'B') {
  return participants.filter((participant) => participant.teamId === teamId)
}

function generateDistinctSinglesPermutations(size: number, count: number): number[][] {
  const base = Array.from({ length: size }, (_, index) => index)
  const permutations: number[][] = []
  let attempts = 0

  while (permutations.length < count && attempts < 2000) {
    attempts += 1
    const candidate = shuffle(base)
    const isValid = permutations.every((permutation) =>
      permutation.every((opponentIndex, playerIndex) => opponentIndex !== candidate[playerIndex]),
    )

    if (isValid) {
      permutations.push(candidate)
    }
  }

  if (permutations.length < count) {
    return [
      base,
      base.map((_, index) => (index + 1) % size),
      base.map((_, index) => (index + 2) % size),
    ]
  }

  return permutations
}

function generateCyclePairs(ids: string[]): string[][] {
  const ordered = shuffle(ids)
  return ordered.map((id, index) => [id, ordered[(index + 1) % ordered.length] as string])
}

function buildMosconiSchedule(teamA: Participant[], teamB: Participant[]): Match[] {
  const teamAIds = teamA.map((participant) => participant.id)
  const teamBIds = teamB.map((participant) => participant.id)

  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const permutations = generateDistinctSinglesPermutations(MOSCONI_PLAYERS_PER_TEAM, 3)
    const singles: Match[] = []

    permutations.forEach((permutation) => {
      permutation.forEach((opponentIndex, playerIndex) => {
        const playerA = teamA[playerIndex]
        const playerB = teamB[opponentIndex]
        if (!playerA || !playerB) return

        singles.push({
          id: generateId(),
          roundIndex: 0,
          matchIndex: 0,
          participantA: playerA.id,
          participantB: playerB.id,
          scoreA: null,
          scoreB: null,
          status: 'pending',
          winner: null,
          matchType: 'single',
          lineupA: [playerA.id],
          lineupB: [playerB.id],
          displayNameA: playerA.name,
          displayNameB: playerB.name,
        })
      })
    })

    const doublesA = generateCyclePairs(teamAIds)
    const doublesB = shuffle(generateCyclePairs(teamBIds))

    const doubles: Match[] = doublesA.map((pairA, index) => ({
      id: generateId(),
      roundIndex: 0,
      matchIndex: 0,
      participantA: pairA[0] ?? null,
      participantB: doublesB[index]?.[0] ?? null,
      scoreA: null,
      scoreB: null,
      status: 'pending',
      winner: null,
      matchType: 'double',
      lineupA: pairA,
      lineupB: doublesB[index] ?? [],
      displayNameA: pairA
        .map((id) => teamA.find((participant) => participant.id === id)?.name ?? '?')
        .join(' + '),
      displayNameB: (doublesB[index] ?? [])
        .map((id) => teamB.find((participant) => participant.id === id)?.name ?? '?')
        .join(' + '),
    }))

    const coverageA = new Map(teamAIds.map((id) => [id, new Set<string>()]))
    const coverageB = new Map(teamBIds.map((id) => [id, new Set<string>()]))

    for (const match of [...singles, ...doubles]) {
      for (const playerId of match.lineupA ?? []) {
        const bucket = coverageA.get(playerId)
        for (const opponentId of match.lineupB ?? []) {
          bucket?.add(opponentId)
        }
      }
      for (const playerId of match.lineupB ?? []) {
        const bucket = coverageB.get(playerId)
        for (const opponentId of match.lineupA ?? []) {
          bucket?.add(opponentId)
        }
      }
    }

    const teamACoversAll = Array.from(coverageA.values()).every((bucket) => bucket.size === 5)
    const teamBCoversAll = Array.from(coverageB.values()).every((bucket) => bucket.size === 5)

    if (!teamACoversAll || !teamBCoversAll) continue

    return shuffle([...singles, ...doubles]).map((match, index) => ({
      ...match,
      roundIndex: index,
      matchIndex: index,
      label: `Game ${index + 1}`,
    }))
  }

  return []
}

function getMosconiScore(tournament: Tournament) {
  return tournament.matches.reduce(
    (score, match) => {
      if (match.winner === 'mosconi:A') score.A += 1
      if (match.winner === 'mosconi:B') score.B += 1
      return score
    },
    { A: 0, B: 0 },
  )
}

export function useTournament() {
  const tournaments = useLocalStorage<Tournament[]>('vibe-tournaments', [])
  const currentView = ref<TournamentView>('list')
  const currentTournamentId = ref<string | null>(null)
  const editingTournamentId = ref<string | null>(null)

  const currentTournament = computed(
    () =>
      tournaments.value.find((tournament) => tournament.id === currentTournamentId.value) ?? null,
  )

  function navigateTo(view: TournamentView, tournamentId?: string) {
    currentView.value = view
    if (tournamentId) currentTournamentId.value = tournamentId
  }

  function createTournament(
    name: string,
    sport: string,
    format: TournamentFormat,
  ): { ok: boolean; error?: string } {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Tên giải đấu không được để trống' }
    if (!sport.trim()) return { ok: false, error: 'Tên bộ môn không được để trống' }

    const duplicate = tournaments.value.find(
      (tournament) => tournament.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) return { ok: false, error: 'Tên giải đấu đã tồn tại' }

    const tournament: Tournament = {
      id: generateId(),
      name: trimmed,
      sport: sport.trim(),
      format,
      status: 'setup',
      participants: [],
      matches: [],
      groups: [],
      knockoutStage: null,
      roundRobinLegs: 1,
      groupCount: null,
      advancePerGroup: 2,
      mosconiTeams: [
        { id: 'A', name: 'Đội A' },
        { id: 'B', name: 'Đội B' },
      ],
      mosconiTargetPoints: MOSCONI_TOTAL_GAMES,
      createdAt: Date.now(),
    }

    tournaments.value.push(tournament)
    navigateTo('detail', tournament.id)
    return { ok: true }
  }

  function updateTournament(
    id: string,
    data: { name?: string; sport?: string; format?: TournamentFormat },
  ): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === id)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.status !== 'setup')
      return { ok: false, error: 'Chỉ được sửa khi đang thiết lập' }

    if (data.name !== undefined) {
      const trimmed = data.name.trim()
      if (!trimmed) return { ok: false, error: 'Tên giải đấu không được để trống' }
      const duplicate = tournaments.value.find(
        (item) => item.id !== id && item.name.toLowerCase() === trimmed.toLowerCase(),
      )
      if (duplicate) return { ok: false, error: 'Tên giải đấu đã tồn tại' }
      tournament.name = trimmed
    }

    if (data.sport !== undefined) tournament.sport = data.sport.trim()
    if (data.format !== undefined) tournament.format = data.format
    return { ok: true }
  }

  function deleteTournament(id: string) {
    const index = tournaments.value.findIndex((tournament) => tournament.id === id)
    if (index === -1) return

    tournaments.value.splice(index, 1)
    if (currentTournamentId.value === id) {
      navigateTo('list')
    }
  }

  function addParticipant(tournamentId: string, name: string): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.status !== 'setup')
      return { ok: false, error: 'Không thể thêm khi đang thi đấu' }

    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Tên không được để trống' }

    const duplicate = tournament.participants.find(
      (participant) => participant.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) return { ok: false, error: 'Tên đã tồn tại trong giải đấu' }

    tournament.participants.push({ id: generateId(), name: trimmed })
    return { ok: true }
  }

  function addMosconiParticipant(
    tournamentId: string,
    teamId: 'A' | 'B',
    name: string,
  ): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.status !== 'setup')
      return { ok: false, error: 'Không thể thêm khi đang thi đấu' }
    if (tournament.format !== 'mosconi-cup')
      return { ok: false, error: 'Giải này không dùng thể thức Mosconi Cup' }

    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Tên không được để trống' }

    const duplicate = tournament.participants.find(
      (participant) => participant.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) return { ok: false, error: 'Tên đã tồn tại trong giải đấu' }

    const teamPlayers = getTeamParticipants(tournament.participants, teamId)
    if (teamPlayers.length >= MOSCONI_PLAYERS_PER_TEAM) {
      return { ok: false, error: 'Mỗi đội chỉ nhận tối đa 5 người chơi' }
    }

    tournament.participants.push({ id: generateId(), name: trimmed, teamId })
    return { ok: true }
  }

  function addParticipantsBulk(
    tournamentId: string,
    text: string,
  ): { ok: boolean; added: number; errors: string[] } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, added: 0, errors: ['Giải đấu không tồn tại'] }
    if (tournament.status !== 'setup') {
      return { ok: false, added: 0, errors: ['Không thể thêm khi đang thi đấu'] }
    }

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    let added = 0
    const errors: string[] = []

    for (const line of lines) {
      const result = addParticipant(tournamentId, line)
      if (result.ok) {
        added += 1
      } else {
        errors.push(`"${line}": ${result.error}`)
      }
    }

    return { ok: errors.length === 0, added, errors }
  }

  function removeParticipant(tournamentId: string, participantId: string) {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament || tournament.status !== 'setup') return

    tournament.participants = tournament.participants.filter(
      (participant) => participant.id !== participantId,
    )
  }

  function editParticipant(
    tournamentId: string,
    participantId: string,
    newName: string,
  ): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.status !== 'setup') return { ok: false, error: 'Không thể sửa khi đang thi đấu' }

    const trimmed = newName.trim()
    if (!trimmed) return { ok: false, error: 'Tên không được để trống' }

    const duplicate = tournament.participants.find(
      (participant) =>
        participant.id !== participantId &&
        participant.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) return { ok: false, error: 'Tên đã tồn tại' }

    const participant = tournament.participants.find((item) => item.id === participantId)
    if (participant) participant.name = trimmed
    return { ok: true }
  }

  function renameMosconiTeam(
    tournamentId: string,
    teamId: 'A' | 'B',
    name: string,
  ): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }

    const team = tournament.mosconiTeams.find((item) => item.id === teamId)
    if (!team) return { ok: false, error: 'Không tìm thấy đội' }

    team.name = name.trim() || `Đội ${teamId}`
    return { ok: true }
  }

  function configureMosconiMatch(
    tournamentId: string,
    matchId: string,
    lineupA: string[],
    lineupB: string[],
  ): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.format !== 'mosconi-cup') return { ok: false, error: 'Sai thể thức giải đấu' }

    const match = tournament.matches.find((item) => item.id === matchId)
    if (!match) return { ok: false, error: 'Không tìm thấy trận đấu' }

    match.lineupA = [...lineupA]
    match.lineupB = [...lineupB]
    match.participantA = lineupA[0] ?? null
    match.participantB = lineupB[0] ?? null
    match.displayNameA = lineupA
      .map(
        (id) => tournament.participants.find((participant) => participant.id === id)?.name ?? '?',
      )
      .join(' + ')
    match.displayNameB = lineupB
      .map(
        (id) => tournament.participants.find((participant) => participant.id === id)?.name ?? '?',
      )
      .join(' + ')
    return { ok: true }
  }

  function startTournament(
    tournamentId: string,
    randomize: boolean = true,
  ): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.status !== 'setup') return { ok: false, error: 'Giải đấu đã bắt đầu' }

    const participantCount = tournament.participants.length
    if (participantCount < 2) return { ok: false, error: 'Cần ít nhất 2 người tham gia' }

    if (tournament.format === 'group-knockout' && participantCount < 4) {
      return { ok: false, error: 'Group Stage + Knockout cần ít nhất 4 người tham gia' }
    }

    if (tournament.format === 'mosconi-cup') {
      const teamA = getTeamParticipants(tournament.participants, 'A')
      const teamB = getTeamParticipants(tournament.participants, 'B')
      if (teamA.length !== MOSCONI_PLAYERS_PER_TEAM || teamB.length !== MOSCONI_PLAYERS_PER_TEAM) {
        return { ok: false, error: 'Mosconi custom này cần đúng 5 người cho mỗi đội' }
      }

      const schedule = buildMosconiSchedule(teamA, teamB)
      if (schedule.length !== MOSCONI_TOTAL_GAMES) {
        return { ok: false, error: 'Không thể tạo lịch Mosconi phù hợp, hãy thử đổi lại đội hình' }
      }

      tournament.matches = schedule
      tournament.status = 'in-progress'
      return { ok: true }
    }

    switch (tournament.format) {
      case 'single-elimination':
        tournament.matches = generateSingleEliminationMatches(tournament.participants, randomize)
        break

      case 'double-elimination':
        tournament.matches = generateDoubleEliminationMatches(tournament.participants, randomize)
        break

      case 'group-knockout': {
        const groupCount = tournament.groupCount ?? autoGroupCount(participantCount)
        tournament.groupCount = groupCount
        tournament.groups = generateGroups(tournament.participants, groupCount, randomize)
        tournament.knockoutStage = null
        break
      }

      case 'round-robin': {
        const ids = randomize
          ? shuffle(tournament.participants.map((participant) => participant.id))
          : tournament.participants.map((participant) => participant.id)
        tournament.matches = generateRoundRobinMatches(ids, tournament.roundRobinLegs)
        break
      }
    }

    tournament.status = 'in-progress'
    return { ok: true }
  }

  function submitMatchResult(
    tournamentId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.status !== 'in-progress') {
      return { ok: false, error: 'Giải đấu không ở trạng thái thi đấu' }
    }
    if (scoreA < 0 || scoreB < 0) return { ok: false, error: 'Điểm số phải >= 0' }
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
      return { ok: false, error: 'Điểm số phải là số nguyên' }
    }

    let match: Match | undefined
    let matchList: Match[] = tournament.matches

    if (tournament.format === 'group-knockout' && !tournament.knockoutStage) {
      for (const group of tournament.groups) {
        match = group.matches.find((item) => item.id === matchId)
        if (match) {
          matchList = group.matches
          break
        }
      }
    } else if (tournament.format === 'group-knockout' && tournament.knockoutStage) {
      match = tournament.knockoutStage.matches.find((item) => item.id === matchId)
      if (match) {
        matchList = tournament.knockoutStage.matches
      } else {
        for (const group of tournament.groups) {
          match = group.matches.find((item) => item.id === matchId)
          if (match) {
            matchList = group.matches
            break
          }
        }
      }
    } else {
      match = tournament.matches.find((item) => item.id === matchId)
    }

    if (!match) return { ok: false, error: 'Không tìm thấy trận đấu' }

    if (tournament.format === 'mosconi-cup' && scoreA === scoreB) {
      return { ok: false, error: 'Thể thức này không cho phép hòa' }
    }

    const isElimination =
      tournament.format === 'single-elimination' ||
      tournament.format === 'double-elimination' ||
      (tournament.format === 'group-knockout' && tournament.knockoutStage?.matches.includes(match))

    if (isElimination && scoreA === scoreB) {
      return { ok: false, error: 'Vòng loại trực tiếp không được hòa' }
    }

    const oldWinner = match.winner
    match.scoreA = scoreA
    match.scoreB = scoreB
    match.status = 'done'

    if (scoreA > scoreB) {
      match.winner = tournament.format === 'mosconi-cup' ? 'mosconi:A' : match.participantA
    } else if (scoreB > scoreA) {
      match.winner = tournament.format === 'mosconi-cup' ? 'mosconi:B' : match.participantB
    } else {
      match.winner = null
    }

    if (isElimination && oldWinner && oldWinner !== match.winner) {
      clearDownstreamMatches(matchList, match, oldWinner)
    }

    if (isElimination && match.winner) {
      advanceWinner(matchList, match)
    }

    if (tournament.format === 'group-knockout') {
      const group = tournament.groups.find((item) =>
        item.matches.some((entry) => entry.id === matchId),
      )
      if (group) recalcStandings(group)
    }

    checkTournamentCompletion(tournament)
    return { ok: true }
  }

  function startKnockoutStage(tournamentId: string): { ok: boolean; error?: string } {
    const tournament = tournaments.value.find((item) => item.id === tournamentId)
    if (!tournament) return { ok: false, error: 'Giải đấu không tồn tại' }
    if (tournament.format !== 'group-knockout') {
      return { ok: false, error: 'Chỉ dùng cho Group Stage + Knockout' }
    }
    if (!isGroupStageComplete(tournament.groups)) {
      return { ok: false, error: 'Vòng bảng chưa hoàn tất' }
    }

    const advancing = getAdvancingParticipants(tournament.groups, tournament.advancePerGroup)
    if (advancing.length < 2) return { ok: false, error: 'Không đủ đội đi tiếp' }

    const participants = advancing
      .map((id) => tournament.participants.find((participant) => participant.id === id))
      .filter(
        (participant): participant is NonNullable<typeof participant> => participant !== undefined,
      )

    const knockoutMatches = generateSingleEliminationMatches(participants, false)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(participants.length)))

    tournament.knockoutStage = {
      matches: knockoutMatches,
      rounds: Math.log2(bracketSize),
    }

    return { ok: true }
  }

  function checkTournamentCompletion(tournament: Tournament): void {
    let allDone = false

    switch (tournament.format) {
      case 'single-elimination':
      case 'double-elimination':
        allDone = tournament.matches
          .filter((match) => !match.isBye)
          .every((match) => match.status === 'done')
        break

      case 'round-robin':
        allDone = tournament.matches.every((match) => match.status === 'done')
        break

      case 'group-knockout':
        if (tournament.knockoutStage) {
          const groupsDone = tournament.groups.every((group) =>
            group.matches.every((match) => match.status === 'done'),
          )
          const knockoutDone = tournament.knockoutStage.matches
            .filter((match) => !match.isBye)
            .every((match) => match.status === 'done')
          allDone = groupsDone && knockoutDone
        }
        break

      case 'mosconi-cup':
        allDone = tournament.matches.every((match) => match.status === 'done')
        break
    }

    if (allDone) tournament.status = 'finished'
  }

  function getParticipantName(tournament: Tournament, id: string | null): string {
    if (!id) return 'TBD'
    return tournament.participants.find((participant) => participant.id === id)?.name ?? 'TBD'
  }

  function getChampion(tournament: Tournament): string | null {
    if (tournament.format === 'mosconi-cup') {
      const score = getMosconiScore(tournament)
      if (score.A === score.B) return null
      const winnerId = score.A > score.B ? 'A' : 'B'
      return tournament.mosconiTeams.find((team) => team.id === winnerId)?.name ?? null
    }

    if (tournament.format === 'round-robin') {
      const standings = calcRoundRobinStandings(
        tournament.participants.map((participant) => participant.id),
        tournament.matches,
      )
      return standings[0]?.participantId ?? null
    }

    if (tournament.format === 'group-knockout' && tournament.knockoutStage) {
      const finalMatch = tournament.knockoutStage.matches
        .filter((match) => !match.isBye)
        .reduce((current, next) => (current.roundIndex > next.roundIndex ? current : next))
      return finalMatch?.winner ?? null
    }

    const nonByeMatches = tournament.matches.filter((match) => !match.isBye)
    if (nonByeMatches.length === 0) return null

    const finalMatch = nonByeMatches.reduce((current, next) =>
      current.roundIndex > next.roundIndex ? current : next,
    )
    return finalMatch?.winner ?? null
  }

  return {
    tournaments,
    currentView,
    currentTournamentId,
    editingTournamentId,
    currentTournament,
    navigateTo,
    createTournament,
    updateTournament,
    deleteTournament,
    addParticipant,
    addMosconiParticipant,
    addParticipantsBulk,
    removeParticipant,
    editParticipant,
    renameMosconiTeam,
    configureMosconiMatch,
    startTournament,
    submitMatchResult,
    startKnockoutStage,
    getParticipantName,
    getChampion,
    calcRoundRobinStandings,
    getMosconiScore,
  }
}
