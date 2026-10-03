import { Stack } from 'expo-router';
import { DocentesProvider } from '../context/DocentesContext';
import { OnePieceProvider } from '../context/OnePieceContext';
import { PokemonProvider } from '../context/PokemonContext';

export default function RootLayout() {
  return (
    <PokemonProvider>
      <OnePieceProvider>
        {/*
          DocentesProvider va por fuera del <Stack>, y no por dentro, a proposito.

          Las fichas de Pokemon y de One Piece viven DENTRO del grupo (tabs), asi
          que su provider podria ir tambien dentro y no notaria la diferencia. La
          pagina de la ficha de un docente (app/docente/[id].tsx) esta FUERA de ese
          grupo: es una pantalla completa con su propio boton de atras. Si el
          provider estuviera dentro de (tabs), al navegar a la ficha se
          DESMONTARIA y perderia el estado, y al volver atras habria que pedir de
          nuevo las veinte tarjetas de la lista.

          Ponerlo aqui arriba hace que sobreviva a la navegacion entre pestanas y
          entre paginas, que es justo lo que se necesita para que la quinta
          pestana se recargue sola al volver a ella.
        */}
        <DocentesProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DocentesProvider>
      </OnePieceProvider>
    </PokemonProvider>
  );
}