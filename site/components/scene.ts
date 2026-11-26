/** Where the hero's 3D scene ends on a phone (Story.tsx stages): its move played out, the phone with the live demo takes its place. */
export const SCENE_END = 0.3

/** How far the scene's move is at `at`: 0 at the top of the page, 1 once it has played out. */
export const sceneProgress = (at: number) => Math.min(1, Math.max(0, at / SCENE_END))
