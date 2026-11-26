import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

// A static export has no search server: the index is built into a file the visitor's browser downloads and searches.
export const revalidate = false
export const { staticGET: GET } = createFromSource(source, { language: 'english' })
