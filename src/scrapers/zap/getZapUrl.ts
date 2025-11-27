import { Property } from '../../types';

function slugify(value: string): string {
  return value
    .normalize('NFD')                   // separa acentos
    .replace(/[\u0300-\u036f]/g, '')    // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')       // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-');             // espaços -> hífen
}

function buildRangeParam(min: number, max: number): string {
  const values: number[] = [];
  for (let v = min; v <= max; v++) {
    values.push(v);
  }
  return values.join('%2C'); // encode da vírgula
}

function mapTipoZap(type: string): string {
  switch (type.toLowerCase()) {
    case 'apartamento':
      return 'apartamento_residencial';
    // você pode adicionar mais mapeamentos aqui
    default:
      return 'apartamento_residencial';
  }
}

export function buildZapUrlFromProperty(property: Property): string {
  // Base fixa (focado em RJ, como seu contexto atual)
  const stateUfSlug = 'rj';
  const citySlug = slugify(property.city); // "rio-de-janeiro"
  const streetSlug = slugify(property.street); // "rua-real-grandeza"

  // Tipo no path (plural simples para apartamentos)
  // Se quiser algo mais genérico, pode criar um map.
  const tipoPath = property.type.toLowerCase() === 'apartamento'
    ? 'apartamentos'
    : slugify(property.type) + 's';

  // Preço mínimo/máximo (±20%)
  const precoMinimo = Math.round(property.price * 0.8);
  const precoMaximo = Math.round(property.price * 1.2);

  // Quartos / banheiros: do valor do imóvel até 4
  const minQuartos = Math.max(1, property.bedrooms);
  const minBanheiros = Math.max(1, property.bathrooms);
  const quartosParam = buildRangeParam(minQuartos, 4);
  const banheirosParam = buildRangeParam(minBanheiros, 4);

  // Área fixa (min = max)
  const areaMinima = property.area_m2;
  const areaMaxima = property.area_m2;

  // "onde" simplificado (sem zona/lat/long)
  const rawOndeParts = [
    '',                              // primeiro vazio -> começa com vírgula
    property.city,                   // Rio de Janeiro
    property.city,                   // Rio de Janeiro
    '',                              // vazio (posição da zona, por ex.)
    property.neighborhood,           // Botafogo
    property.street,                 // Rua Real Grandeza
    '',                              // vazio
    'street',
    // BR>Rio de Janeiro>NULL>Rio de Janeiro>>Botafogo
    `BR>${property.city}>NULL>${property.city}>>${property.neighborhood}`,
    ''                               // para gerar a vírgula no final
  ];

  const rawOnde = rawOndeParts.join(',');
  // encodeURIComponent + troca de %20 por + (igual URL que você mandou)
  const onde = encodeURIComponent(rawOnde).replace(/%20/g, '+');

  const tipos = mapTipoZap(property.type);

  const baseUrl = `https://www.zapimoveis.com.br/venda/${tipoPath}/${stateUfSlug}+${citySlug}/${streetSlug}/`;

  const queryString =
    `?transacao=venda` +
    `&onde=${onde}` +
    `&tipos=${tipos}` +
    `&banheiros=${banheirosParam}` +
    `&quartos=${quartosParam}` +
    `&precoMaximo=${precoMaximo}` +
    `&precoMinimo=${precoMinimo}` +
    `&areaMaxima=${areaMaxima}` +
    `&areaMinima=${areaMinima}`;

  return baseUrl + queryString;
}
