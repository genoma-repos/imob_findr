
/**
 * Normaliza nomes para comparação (sem acento, maiúsculo, sem espaços extras)
 */
export default function normalizeName(name: string | null | undefined) {
  if (!name) return null;
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}