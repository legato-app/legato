/** The songs lists' columns, as their headers and menus name them. */
import { msg } from '../i18n/i18n'
import type { Column } from '../theme/layout'

export const COLUMN_NAMES: Record<Column, string> = { album: msg('Album'), year: msg('Year'), genre: msg('Genre'), bpm: msg('BPM'), key: msg('Key'), sources: msg('Sources'), plays: msg('Plays'), rating: msg('Rating'), added: msg('Date added'), duration: msg('Duration') }
