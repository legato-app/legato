import { createContext } from 'react'
import type { Pages } from '../theme/layout'

/** The theme's arrangement of the pages. The shell provides it; none for Settings, Add-ons and dialogs. */
export const PageLayout = createContext<Pages>({})
