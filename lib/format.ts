// ---------------------------------------------------------------------------
// FORMATEADORES DE DATOS
//
// Los valores que llegan de la API vienen en unidades tecnicas o en formatos
// poco legibles (decimetros, hectogramos, "3.000.000.000"). Convertirlos en un
// solo sitio evita que cada pantalla los muestre distinto y que un cambio se
// aplique en unas fichas y en otras no.
//
// Son funciones puras: reciben un valor y devuelven texto, sin tocar estado ni
// la red. Por eso se pueden usar tanto en la busqueda como en las fichas.
// ---------------------------------------------------------------------------

// PokeAPI entrega la altura en decimetros: "4" son 0.4 m.
export const formatHeight = (decimetros?: number) =>
  typeof decimetros === 'number' ? `${(decimetros / 10).toFixed(1)} m` : 'Sin dato';

// El peso llega en hectogramos: "60" son 6.0 kg.
export const formatWeight = (hectogramos?: number) =>
  typeof hectogramos === 'number' ? `${(hectogramos / 10).toFixed(1)} kg` : 'Sin dato';

// PokeAPI devuelve los nombres en minusculas ("charizard"); se capitalizan.
export const capitalize = (text?: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : '';

// Los movimientos llegan como "double-edge"; se cambian los guiones por
// espacios para que se lean como nombres normales.
export const prettyMove = (raw?: string) => {
  if (!raw) return 'Movimiento';
  const clean = raw.replace(/-/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

// La recompensa puede venir como "3.000.000.000" o "3000000000". Se limpian los
// separadores y se agrupan de a tres con puntos; el simbolo del Berry es "฿".
export const formatBounty = (bounty?: string) => {
  if (!bounty) return 'Desconocida';
  const digits = bounty.replace(/[^\d]/g, '');
  if (!digits) return bounty;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `฿ ${grouped}`;
};

// La talla viene como "174cm"; se separa la unidad para que respire.
export const formatSize = (size?: string) => {
  if (!size) return 'Sin dato';
  return size.replace(/\s*(cm|m)\s*$/i, ' $1');
};
