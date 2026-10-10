// ---------------------------------------------------------------------------
// DETECCION DE CONEXION
//
// Distingue tres estados:
//   - true  : hay red (fetch llega al servidor, aunque responda 503)
//   - false : sin red (fetch falla con estado 0 / TypeError)
//   - null  : indeterminado (primer render)
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

let _listener: (() => void) | null = null;
let _online: boolean | null = null;
const _subs: Set<(v: boolean | null) => void> = new Set();

function notify() {
  _subs.forEach(cb => cb(_online));
}

/**
 * Hook para saber si hay conexion de red real.
 * NO trata 503 como "sin conexion": 503 = arranque en frio (hay red, el servidor despierta).
 * Solo estado 0 / fetch failed / network error = modo offline.
 */
export function useConexion(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(_online);

  useEffect(() => {
    _subs.add(setOnline);
    return () => { _subs.delete(setOnline); };
  }, []);

  return online;
}

/** Inicializa el listener global (llamar una vez al arrancar la app). */
export function initConexion(): void {
  if (_listener) return;

  // NetInfo detecta conectividad del dispositivo
  _listener = NetInfo.addEventListener(state => {
    const wasOnline = _online;
    _online = state.isConnected === true && state.isInternetReachable !== false;
    if (_online !== wasOnline) notify();
  });

  // Fallback web: eventos online/offline del navegador
  if (typeof window !== 'undefined') {
    const onOnline = () => { _online = true; notify(); };
    const onOffline = () => { _online = false; notify(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    _listener = () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }
}

/** Fuerza una comprobacion activa (fetch a /health del gateway). */
export async function comprobarConexionReal(apiUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    // Cualquier respuesta HTTP (incluyendo 503) = hay red
    return true;
  } catch {
    // TypeError / AbortError / network error = sin red
    return false;
  }
}

/** Helper para uso en callbacks: devuelve true si hay red, false si modo offline. */
export function hayRed(online: boolean | null): boolean {
  return online === true;
}