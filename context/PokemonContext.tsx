import { createContext, PropsWithChildren, useContext, useState } from 'react';

export type Pokemon = {
  id: number;
  name: string;
  height: number;
  weight: number;
  moves?: Array<{ move?: { name?: string } }>;
  sprites?: { front_default?: string | null };
};

type PokemonContextValue = {
  pokemon: Pokemon | null;
  cargando: boolean;
  mensaje: string;
  buscarPokemon: (nombre: string) => Promise<void>;
};

const PokemonContext = createContext<PokemonContextValue | undefined>(undefined);
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function PokemonProvider({ children }: PropsWithChildren) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const buscarPokemon = async (nombre: string) => {
    const nombreNormalizado = nombre.trim().toLowerCase();

    if (!nombreNormalizado) {
      setPokemon(null);
      setMensaje('Escribe el nombre de un Pokemon.');
      return;
    }

    setCargando(true);
    setMensaje('');

    try {
      const respuesta = await fetch(`${apiUrl}/api/pokemon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombreNormalizado }),
      });

      if (!respuesta.ok) {
        throw new Error(respuesta.status === 404 ? 'Pokemon no encontrado' : 'No se pudo consultar el servicio');
      }

      const datos: Pokemon = await respuesta.json();
      setPokemon(datos);
    } catch (error) {
      setPokemon(null);
      setMensaje(error instanceof Error ? error.message : 'No se pudo consultar el servicio.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <PokemonContext.Provider value={{ pokemon, cargando, mensaje, buscarPokemon }}>
      {children}
    </PokemonContext.Provider>
  );
}

export function usePokemon() {
  const context = useContext(PokemonContext);

  if (!context) {
    throw new Error('usePokemon debe usarse dentro de PokemonProvider');
  }

  return context;
}
