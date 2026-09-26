import { createContext, PropsWithChildren, useContext, useState } from 'react';

export type OnePieceCharacter = {
  id: number;
  name: string;
  size?: string;
  age?: string;
  bounty?: string;
  job?: string;
  status?: string;
  crew?: { name?: string; is_yonko?: boolean };
  fruit?: { name?: string; type?: string; description?: string };
  image?: string | null;
  race?: string;
  raceEstimated?: boolean;
};

type OnePieceContextValue = {
  character: OnePieceCharacter | null;
  cargando: boolean;
  mensaje: string;
  buscarPersonaje: (nombre: string) => Promise<void>;
};

const OnePieceContext = createContext<OnePieceContextValue | undefined>(undefined);
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function OnePieceProvider({ children }: PropsWithChildren) {
  const [character, setCharacter] = useState<OnePieceCharacter | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const buscarPersonaje = async (nombre: string) => {
    if (!nombre.trim()) {
      setCharacter(null);
      setMensaje('Escribe el nombre de un personaje.');
      return;
    }
    setCargando(true);
    setMensaje('');
    try {
      const response = await fetch(`${apiUrl}/api/one-piece`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre.trim() }),
      });
      if (!response.ok) throw new Error(response.status === 404 ? 'Personaje no encontrado' : 'No se pudo consultar One Piece');
      setCharacter(await response.json());
    } catch (error) {
      setCharacter(null);
      setMensaje(error instanceof Error ? error.message : 'No se pudo consultar One Piece.');
    } finally {
      setCargando(false);
    }
  };

  return <OnePieceContext.Provider value={{ character, cargando, mensaje, buscarPersonaje }}>{children}</OnePieceContext.Provider>;
}

export function useOnePiece() {
  const context = useContext(OnePieceContext);
  if (!context) throw new Error('useOnePiece debe usarse dentro de OnePieceProvider');
  return context;
}