import { defineConfig } from 'fumadocs-mdx/config'
import { remarkRepoDocs } from './components/repoDocs'

// Read by createMDX (next.config.ts) for every page; the collection itself is in lib/source.ts.
export default defineConfig({ mdxOptions: { remarkPlugins: [remarkRepoDocs] } })
