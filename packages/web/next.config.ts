import path from 'node:path'
import type { NextConfig } from 'next'

// The static site for GitHub Pages (scripts/build-static.sh, docs/17): plain
// files under a base path, no server, no API. Off for every other build.
const isStatic = process.env.SUPERESTELA_STATIC === '1'
const basePath = isStatic ? (process.env.SUPERESTELA_BASE_PATH ?? '') : ''

// `analysis/outputs/` vive fuera de este proyecto: la app lee el JSON real en
// vez de una copia, para que una deriva entre datos y producto falle en CI
// (ver src/data/paths.ts). Sin anclar la raiz aqui, el tracing de archivos sube
// buscando el limite del repositorio y arrastra lo que no debe.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  typedRoutes: true,
  ...(isStatic
    ? {
        output: 'export',
        basePath,
        // Pages serves folder/index.html, not extensionless files.
        trailingSlash: true,
        images: { unoptimized: true },
        env: {
          NEXT_PUBLIC_SUPERESTELA_STATIC: '1',
          NEXT_PUBLIC_BASE_PATH: basePath,
        },
      }
    : {}),
}

export default nextConfig
