export const DICE_ROLL_MS: number
export const DICE_TOTAL_ENTER_MS: number
export const DICE_TOTAL_PAUSE_MS: number
export const DICE_SHAKE_CYCLE_MS: number
export const HUMAN_MOVEMENT_STEP_MS: number
export const BOT_MOVEMENT_STEP_MS: number
export const LANDING_DELAY_MS: number
export const MODAL_ENTER_MS: number
export const ROLL_LEAD_MS: number
export function presentationRemainingMs(
  game?: { presentation?: { readyAt: number } },
  now?: number,
): number
