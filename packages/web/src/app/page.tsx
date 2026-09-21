import { redirect } from 'next/navigation'

/** La pantalla de aterrizaje es el Radar (`docs/02` seccion 2, P1). */
export default function HomePage() {
  redirect('/radar')
}
