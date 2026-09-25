import { Stack } from 'expo-router';
import { PokemonProvider } from '../context/PokemonContext';

export default function RootLayout() {
  return (
    <PokemonProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PokemonProvider>
  );
}
