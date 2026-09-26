import { Stack } from 'expo-router';
import { OnePieceProvider } from '../context/OnePieceContext';
import { PokemonProvider } from '../context/PokemonContext';

export default function RootLayout() {
  return (
    <PokemonProvider>
      <OnePieceProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OnePieceProvider>
    </PokemonProvider>
  );
}
