import { createContext, PropsWithChildren, useContext, useState } from 'react';

export type Pokemon = {
  id: number;
  name: string;
  height: number;
  weight: number;
  moves?: Array<{ move?: { name?: string } }>;
  sprites?: { front_default?: string | null; front_shiny?: string | null; back_shiny?: string | null };
  types?: Array<{ type?: { name?: string } }>;
  genero?: string;
  especie?: string;
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
    const normalizedName = nombre.trim().toLowerCase();
    if (!normalizedName) {
      setPokemon(null);
      setMensaje('Escribe el nombre de un Pokemon.');
      return;
    }

    setCargando(true);
    setMensaje('');
    try {
      const response = await fetch(`${apiUrl}/api/pokemon/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalizedName }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        if (response.status === 400) throw new Error(detail?.error || 'Escribe el nombre de un Pokemon.');
        if (response.status === 404) throw new Error(detail?.error || 'Pokemon no encontrado en la base de datos local');
        throw new Error(detail?.error || 'No se pudo consultar el servicio');
      }
      const payload = await response.json();
      setPokemon(payload.data?.[0] ?? null);
    } catch (error) {
      setPokemon(null);
      setMensaje(error instanceof Error ? error.message : 'No se pudo consultar el servicio.');
    } finally {
      setCargando(false);
    }
  };

  return <PokemonContext.Provider value={{ pokemon, cargando, mensaje, buscarPokemon }}>{children}</PokemonContext.Provider>;
}

export function usePokemon() {
  const context = useContext(PokemonContext);
  if (!context) throw new Error('usePokemon debe usarse dentro de PokemonProvider');
  return context;
}
