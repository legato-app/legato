import { loader } from 'fumadocs-core/source'
import { defineDocs } from 'fumadocs-mdx/macro'

const docs = defineDocs({ dir: 'content/docs' })

/** The docs' pages (content/docs), under /docs/. */
export const source = loader({ baseUrl: '/docs', source: docs.toFumadocsSource() })
