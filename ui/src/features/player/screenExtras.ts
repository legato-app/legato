/**
 * The analysis that only feeds the screen (the visualizer's frames, the moving cover's levels, the loudness meter), off while the phone's
 * screen is off (shared/screen.ts). Processing (levelling, Adaptive Sound, the Live Editor) and the early ends are not in it: they go on.
 */
export function extrasFor(watching: boolean, asked: { coverPulse: boolean; viz: boolean; meter: boolean }): { coverPulse: boolean; viz: boolean; meter: boolean } {
  return watching ? asked : { coverPulse: false, viz: false, meter: false }
}
