import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { API_URL, log } from '../lib/api';

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
    // Mismo patron que PokemonContext: medir y registrar cada busqueda. El
    // nombre se envia tal cual (sin lower) porque el microservicio es quien
    // normaliza; aqui se registra para ver exactamente que viajo por la red.
    const inicio = Date.now();
    log(`POST /api/characters/search name="${nombre.trim()}" -> ${API_URL}`);
    // 0 = ni siquiera hubo respuesta HTTP (fallo de red o servicio dormido).
    let estado = 0;
    try {
      const response = await fetch(`${API_URL}/api/characters/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre.trim() }),
      });
      estado = response.status;
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        if (response.status === 400) throw new Error(detail?.error || 'Escribe el nombre de un personaje.');
        if (response.status === 404) throw new Error(detail?.error || 'Personaje no encontrado en la base de datos local');
        throw new Error(detail?.error || 'No se pudo consultar el servicio');
      }
      const payload = await response.json();
      const encontrado = payload.data?.[0] ?? null;
      setCharacter(encontrado);
      log(`  ${estado} en ${Date.now() - inicio}ms: ${encontrado ? `encontrado "${encontrado.name}"` : 'sin resultados'}`);
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'No se pudo consultar One Piece.';
      log(`  ${estado || 'sin respuesta'} en ${Date.now() - inicio}ms: ${mensajeError}`);
      setCharacter(null);
      setMensaje(mensajeError);
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