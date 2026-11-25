import type { NextConfig } from 'next'

// Static export for GitHub Pages: https://legato-app.github.io/legato/ (project page, hence the base path; the repo's name).
const config: NextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/legato' : '',
  images: { unoptimized: true },
  trailingSlash: true,
}

export default config
