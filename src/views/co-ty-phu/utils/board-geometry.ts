export function boardPoint(index: number) {
  const i = ((index % 40) + 40) % 40
  const centers = [0.675, ...Array.from({ length: 9 }, (_, n) => 1.85 + n), 11.025]
  let row: number, column: number
  if (i <= 10) {
    row = 10
    column = 10 - i
  } else if (i <= 20) {
    row = 20 - i
    column = 0
  } else if (i <= 30) {
    row = 0
    column = i - 20
  } else {
    row = i - 30
    column = 10
  }
  return { x: (centers[column]! / 11.7) * 100, y: (centers[row]! / 11.7) * 100 }
}
