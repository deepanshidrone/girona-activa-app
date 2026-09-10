export type Difficulty = 'base' | 'regression' | 'progression'

export function levelToDifficulty(level: number): Difficulty {
  if (level === 1) return 'regression'
  if (level === 3) return 'progression'
  return 'base'
}
