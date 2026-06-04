/**
 * Utilidades de búsqueda inteligente para D&F App.
 * Permite buscar sin importar acentos, mayúsculas o caracteres especiales.
 */

/**
 * Normaliza un texto removiendo acentos y diacríticos, y convierte a minúsculas.
 * Ejemplo: "Rímel Wáterpruuf" → "rimel waterpruuf"
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')                     // Descompone caracteres: é → e + ́
    .replace(/[\u0300-\u036f]/g, '')      // Elimina las marcas diacríticas
    .toLowerCase();
}

/**
 * Compara si el texto contiene la query, ignorando acentos y mayúsculas.
 * Ejemplo: fuzzyMatch("Rímel Profesional", "rimel") → true
 */
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  if (!text) return false;
  return normalizeText(text).includes(normalizeText(query));
}
