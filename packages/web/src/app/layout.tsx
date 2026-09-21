import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Anton, Archivo } from 'next/font/google'
import './globals.css'

/*
 * Las dos familias del prototipo, auto-hospedadas por next/font: sin peticion a
 * un tercero, sin salto de maquetacion, y sin depender de la red de la sala el
 * dia de la presentacion. Los tokens de `tokens.json` apuntan a estas variables.
 */
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
})

export const metadata: Metadata = {
  title: 'SuperEstela',
  description: 'Stuff+ para la Liga Mexicana de Beisbol, con la altitud dentro del modelo.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" className={`${anton.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
