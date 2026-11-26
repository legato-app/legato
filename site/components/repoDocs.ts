/** The parts of a Markdown tree's node this reads. */
interface Node {
  type: string
  depth?: number
  url?: string
  children?: Node[]
}

const REPOSITORY = 'https://github.com/legato-app/legato/blob/master/'

/** The docs pages that take in a document of the repository (`<include>`), and where it lives there. */
export const INCLUDED: Record<string, string> = {
  'architecture.mdx': 'docs/architecture.md',
  'plugins.mdx': 'docs/plugins.md',
  'contribute.mdx': 'CONTRIBUTING.md',
}

/** A link written for the repository, as the website needs it. Whole addresses and the page's own anchors stay. */
export const repositoryLink = (link: string, document: string) => (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(link) ? link : new URL(link, REPOSITORY + document).href)

/** For those pages: the document's own title goes (the page has one), its relative links lead to GitHub. */
export function remarkRepoDocs() {
  return (tree: Node, file: { path?: string }) => {
    const path = file.path?.replaceAll('\\', '/') ?? ''
    const name = path.split('/').pop() ?? ''
    const document = path.includes('/content/docs/developers/') ? INCLUDED[name] : undefined
    if (!document) return
    let titled = true
    const walk = (parent: Node) => {
      const children = parent.children ?? []
      for (let index = 0; index < children.length; index++) {
        const node = children[index]
        if (titled && node.type === 'heading' && node.depth === 1) {
          titled = false
          children.splice(index--, 1)
          continue
        }
        if ((node.type === 'link' || node.type === 'definition') && node.url) node.url = repositoryLink(node.url, document)
        walk(node)
      }
    }
    walk(tree)
  }
}
