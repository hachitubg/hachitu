import type { History, Log, Member } from '../types'
export function nightJournal(logs: Log[]) {
  const groups = new Map<number, Log[]>()
  for (const event of logs) {
    if (event.round < 1 || !['night', 'dawn'].includes(event.phase)) continue
    if (!groups.has(event.round)) groups.set(event.round, [])
    groups.get(event.round)!.push(event)
  }
  return [...groups].sort(([a], [b]) => b - a).map(([round, entries]) => ({ round, entries }))
}
export function sessionStandings(members: Member[], history: History[]) {
  const standings = new Map<
    string,
    { id: string; name: string; avatar: string; wins: number; losses: number; present: boolean }
  >()
  for (const game of history) {
    for (const player of game.players) {
      const person = standings.get(player.id) || {
        id: player.id,
        name: player.name,
        avatar: player.avatar || '',
        wins: 0,
        losses: 0,
        present: false,
      }
      if (!['aborted', 'manual'].includes(game.winner)) {
        if (player.won) person.wins++
        else person.losses++
      }
      standings.set(player.id, person)
    }
  }
  for (const member of members.filter((person) => !person.host))
    standings.set(member.id, {
      id: member.id,
      name: member.name,
      avatar: member.avatar,
      wins: member.wins,
      losses: member.losses,
      present: true,
    })
  return [...standings.values()].sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name, 'vi'),
  )
}
