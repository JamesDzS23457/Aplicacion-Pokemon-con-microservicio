import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { API_URL, log, esArranqueFrio, MENSAJE_ARRANQUE_FRIO } from '../lib/api';

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
  /** 'info' para el aviso de arranque en frio; 'error' para fallos reales. */
  tono: 'error' | 'info';
  buscarPokemon: (nombre: string) => Promise<void>;
};

const PokemonContext = createContext<PokemonContextValue | undefined>(undefined);

export function PokemonProvider({ children }: PropsWithChildren) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tono, setTono] = useState<'error' | 'info'>('error');

  const buscarPokemon = async (nombre: string) => {
    const normalizedName = nombre.trim().toLowerCase();
    if (!normalizedName) {
      setPokemon(null);
      setTono('error');
      setMensaje('Escribe el nombre de un Pokemon.');
      return;
    }

    setCargando(true);
    setMensaje('');
    setTono('error');
    // Instante de inicio para medir la duracion. En el plan free de Render la
    // primera busqueda puede tardar ~1 minuto (el servicio estaba dormido).
    const inicio = Date.now();
    // Se registra QUE se va a buscar y CONTRA QUIEN antes de la peticion, para
    // que la linea aparezca aunque la peticion tarde o falle.
    log(`POST /api/pokemon/search name="${normalizedName}" -> ${API_URL}`);
    // `estado` guarda el codigo HTTP real; queda en 0 si ni siquiera hubo
    // respuesta (fallo de red / servicio caido). Asi el catch puede registrar
    // una sola linea por busqueda, con o sin codigo.
    let estado = 0;
    try {
      const response = await fetch(`${API_URL}/api/pokemon/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalizedName }),
      });
      estado = response.status;
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        if (response.status === 400) throw new Error(detail?.error || 'Escribe el nombre de un Pokemon.');
        if (response.status === 404) throw new Error(detail?.error || 'Pokemon no encontrado en la base de datos local');
        throw new Error(detail?.error || 'No se pudo consultar el servicio');
      }
      const payload = await response.json();
      const encontrado = payload.data?.[0] ?? null;
      setPokemon(encontrado);
      log(`  ${estado} en ${Date.now() - inicio}ms: ${encontrado ? `encontrado "${encontrado.name}"` : 'sin resultados'}`);
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'No se pudo consultar el servicio.';
      log(`  ${estado || 'sin respuesta'} en ${Date.now() - inicio}ms: ${mensajeError}`);
      setPokemon(null);
      // El arranque en frio no es culpa del usuario: se muestra como aviso
      // informativo, con un texto que explica que hay que reintentar.
      if (esArranqueFrio(estado, mensajeError)) {
        setTono('info');
        setMensaje(MENSAJE_ARRANQUE_FRIO);
      } else {
        setTono('error');
        // Si `estado` sigue en 0 el navegador no recibio ni un codigo HTTP: la
        // peticion no llego al gateway (sin red, CORS...). Se muestra un texto
        // en espanol en lugar del "Failed to fetch" en ingles del navegador.
        setMensaje(estado === 0 ? 'No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.' : mensajeError);
      }
    } finally {
      setCargando(false);
    }
  };

  return <PokemonContext.Provider value={{ pokemon, cargando, mensaje, tono, buscarPokemon }}>{children}</PokemonContext.Provider>;
}

export function usePokemon() {
  const context = useContext(PokemonContext);
  if (!context) throw new Error('usePokemon debe usarse dentro de PokemonProvider');
  return context;
}
