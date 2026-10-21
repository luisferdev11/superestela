import path from 'node:path'
import type { NextConfig } from 'next'

// `analysis/outputs/` vive fuera de este proyecto: la app lee el JSON real en
// vez de una copia, para que una deriva entre datos y producto falle en CI
// (ver src/data/paths.ts). Sin anclar la raiz aqui, el tracing de archivos sube
// buscando el limite del repositorio y arrastra lo que no debe.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  typedRoutes: true,
  experimental: {
    // With src/proxy.ts every request body is buffered, 10 MB by default; the
    // translator takes files of up to 20 MB, sent as JSON.
    proxyClientMaxBodySize: '25mb',
  },
}

export default nextConfig
