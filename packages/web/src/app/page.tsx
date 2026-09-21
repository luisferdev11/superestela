/**
 * Marcador de posicion. La pantalla de aterrizaje es el Radar de Fichajes
 * (`docs/02` seccion 2, P1) y llega en su propio PR; esta pagina existe para
 * que el andamio se pueda construir y el job `web` del CI tenga algo que
 * revisar. No muestra ninguna cifra a proposito: un numero sin su corrida
 * detras no entra ni como marcador de posicion.
 */
export default function HomePage() {
  return (
    <main>
      <h1>SuperEstela</h1>
      <p>Stuff+ para la Liga Mexicana de Beisbol, con la altitud dentro del modelo.</p>
    </main>
  )
}
