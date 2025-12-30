/**
 * Utilidades de saneamiento para prevenir XSS y problemas de renderizado HTML
 */

/**
 * Escapa caracteres especiales de HTML para prevenir inyecciones.
 * Maneja null, undefined y convierte a string.
 */
export const escapeHtml = (input: string | null | undefined): string => {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/`/g, "&#96;");
};

/**
 * Procesa texto de forma segura: trunca, convierte a mayúsculas (opcional) 
 * y finalmente escapa las entidades HTML.
 */
export interface SafeTextOptions {
  maxLen?: number;
  upper?: boolean;
}

export const safeText = (input: string | null | undefined, opts: SafeTextOptions = {}): string => {
  if (input === null || input === undefined) return "";
  
  let text = String(input);
  
  // 1. Transformación de mayúsculas
  if (opts.upper) {
    text = text.toUpperCase();
  }
  
  // 2. Truncado ANTES de escapar (Crítico para no romper entidades como &amp;)
  if (typeof opts.maxLen === 'number' && opts.maxLen >= 0 && text.length > opts.maxLen) {
    text = text.substring(0, opts.maxLen);
  }
  
  // 3. Escape final
  return escapeHtml(text);
};
