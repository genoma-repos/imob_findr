// src/zap/saveZapResults.ts
import { supabase } from '../../db/supabaseClient';
import { Property, ZapPropertyCard } from '../../types';
import parsePrice from '../../utils/parsePrice';
import normalizeName from '../../utils/normalizeName';

/**
 * Upsert do anunciante na tabela "advertisers"
 * Usa normalized_name como chave de conflito
 */
async function upsertAdvertiser(card: ZapPropertyCard) {
  const name = card.sellerName?.trim() || 'DESCONHECIDO';
  const normalized_name = normalizeName(name);

  // Regra simples pra identificar DNA (melhorar depois se quiser)
  const is_dna = normalized_name?.includes('DNA IMOVEIS') ?? false;

  const { data, error } = await supabase
    .from('advertisers')
    .upsert(
      {
        name,
        normalized_name,
        creci: card.advertiserCode ?? null,
        is_dna,
      },
      { onConflict: 'normalized_name' }
    )
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao upsert advertiser:', error);
    throw error;
  }

  return data.id as number;
}

/**
 * Upsert do anúncio na tabela "zap_listings"
 * Usa URL como chave única (onConflict: 'url')
 * Agora também grava area_m2, bedrooms, bathrooms
 */
async function upsertZapListing(card: ZapPropertyCard, advertiserId: number | null) {
  const price = parsePrice(card.priceNumber);
  console.log(card);
  

  // Em muitos casos o href vem relativo, então prefixamos
  const url = card.href?.startsWith('http')
    ? card.href
    : card.href
    ? `https://www.zapimoveis.com.br${card.href}`
    : ''; // fallback

  if (!url) {
    throw new Error('Card da Zap sem href/url válido.');
  }

  const { data, error } = await supabase
    .from('zap_listings')
    .upsert(
      {
        url,
        source_listing_id: card.zapCode ?? null,
        title: card.title,
        street: card.streetText || null,        

        neighborhood: card.neighborhood || null,
        city: card.neighborhood || null,
        price,
        advertiser_id: advertiserId,
        area_m2: card.areaM2 ?? null,
        bedrooms: card.bedrooms ?? null,
        bathrooms: card.bathrooms ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'url' }
    )
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao upsert zap_listing:', error);
    throw error;
  }

  return data.id as number;
}

/**
 * Insere uma linha no histórico de preços (zap_listing_prices)
 */
async function insertPriceHistory(zapListingId: number, price: number | null) {
  if (price == null) return;

  const { error } = await supabase.from('zap_listing_prices').insert({
    zap_listing_id: zapListingId,
    price,
  });

  if (error) {
    console.error('Erro ao inserir histórico de preço:', error);
    throw error;
  }
}

/**
 * Calcula diferença percentual de preço (Zap vs DNA)
 */
function calcPriceDiffPct(dnaPrice: number | null, zapPrice: number | null) {
  if (!dnaPrice || !zapPrice) return null;
  const diff = ((zapPrice - dnaPrice) / dnaPrice) * 100;
  return Number(diff.toFixed(2));
}

/**
 * Verifica se está dentro de ±10% do preço da DNA
 */
function calcWithin10Pct(dnaPrice: number | null, zapPrice: number | null) {
  const diffPct = calcPriceDiffPct(dnaPrice, zapPrice);
  if (diffPct == null) return null;
  return Math.abs(diffPct) <= 10;
}

/**
 * Similaridade mais rica, usando:
 * - rua
 * - bairro (via locationText)
 * - m² aproximado
 * - quartos
 * - banheiros
 *
 * Score final entre 0 e 1.
 */
function calcSimpleSimilarity(property: Property, card: ZapPropertyCard): number {
  let score = 0;

  const dnaStreet = normalizeName(property.street);
  const zapStreet = normalizeName(card.streetText);

  const dnaNeighborhood = normalizeName(property.neighborhood);
  const locNorm = normalizeName(card.locationText);

  // Rua exata
  if (dnaStreet && zapStreet && dnaStreet === zapStreet) {
    score += 0.4;
  }

  // Bairro contido na descrição de localização
  if (dnaNeighborhood && locNorm && locNorm.includes(dnaNeighborhood)) {
    score += 0.2;
  }

  // m² aproximado (±10%)
  if (property.area_m2 && card.areaM2) {
    const dnaArea = property.area_m2;
    const zapArea = card.areaM2;
    const diffPct = Math.abs(zapArea - dnaArea) / dnaArea * 100;

    if (diffPct <= 5) {
      score += 0.2; // muito próximo
    } else if (diffPct <= 10) {
      score += 0.1; // ok
    }
  }

  // Quartos
  if (property.bedrooms != null && card.bedrooms != null) {
    if (property.bedrooms === card.bedrooms) {
      score += 0.1;
    } else if (Math.abs(property.bedrooms - card.bedrooms) === 1) {
      score += 0.05;
    }
  }

  // Banheiros
  if (property.bathrooms != null && card.bathrooms != null) {
    if (property.bathrooms === card.bathrooms) {
      score += 0.1;
    } else if (Math.abs(property.bathrooms - card.bathrooms) === 1) {
      score += 0.05;
    }
  }

  return Math.min(score, 1);
}

/**
 * Busca a linha da tabela dna_properties a partir do dna_id
 */
async function getDnaPropertyRow(property: Property) {
  const { data, error } = await supabase
    .from('dna_properties')
    .select('id, price, street, neighborhood, bedrooms, bathrooms, parking_spaces, area_m2')
    .eq('dna_id', property.dna_id)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar dna_properties por dna_id:', error);
    throw error;
  }

  if (!data) {
    console.warn(
      `Imóvel DNA com dna_id=${property.dna_id} não encontrado em dna_properties.`
    );
  }

  return data as
    | {
        id: number;
        price: number | null;
        street: string | null;
        neighborhood: string | null;
        bedrooms: number | null;
        bathrooms: number | null;
        parking_spaces: number | null;
        area_m2: number | null;
      }
    | null;
}

/**
 * Cria um registro de match DNA x Zap em property_matches
 */
async function insertPropertyMatch(
  dnaPropertyId: number,
  zapListingId: number,
  property: Property,
  card: ZapPropertyCard,
  runId?: number
) {
  const dnaPrice = property.price ?? null;
  const zapPrice = parsePrice(card.priceNumber);

  const similarity_score = calcSimpleSimilarity(property, card);
  const price_diff_pct = calcPriceDiffPct(dnaPrice, zapPrice);
  const within_10pct = calcWithin10Pct(dnaPrice, zapPrice);

  const areaDiffPct =
    property.area_m2 && card.areaM2
      ? Number(
          (
            Math.abs(card.areaM2 - property.area_m2) / property.area_m2 * 100
          ).toFixed(2)
        )
      : null;

  const criteria_json = {
    dna_street: property.street,
    zap_street: card.streetText,
    locationText: card.locationText,
    dna_area_m2: property.area_m2 ?? null,
    zap_area_m2: card.areaM2 ?? null,
    area_diff_pct: areaDiffPct,
    dna_bedrooms: property.bedrooms ?? null,
    zap_bedrooms: card.bedrooms ?? null,
    dna_bathrooms: property.bathrooms ?? null,
    zap_bathrooms: card.bathrooms ?? null,
  };

  const { error } = await supabase.from('property_matches').insert({
    dna_property_id: dnaPropertyId,
    zap_listing_id: zapListingId,
    run_id: runId ?? null,
    similarity_score,
    price_diff_pct,
    within_10pct,
    criteria_json,
  });

  if (error) {
    console.error('Erro ao inserir property_match:', error);
    throw error;
  }
}

/**
 * Função principal: recebe o imóvel da DNA + cards da Zap e:
 *  - garante advertiser
 *  - garante zap_listing
 *  - grava histórico de preço
 *  - cria os matches DNA x Zap
 */
export async function saveZapResultsForProperty(
  property: Property,
  zapCards: ZapPropertyCard[],
  runId?: number
) {
  const dnaRow = await getDnaPropertyRow(property);
  if (!dnaRow) {
    console.warn(
      `Pulando persistência para DNA ID ${property.dna_id} porque não há registro em dna_properties`
    );
    return;
  }

  for (const card of zapCards.filter(c => 
    c.href &&
    c.streetText
  )) {
    try {
      const advertiserId = card.sellerName
        ? await upsertAdvertiser(card)
        : null;

      const zapListingId = await upsertZapListing(card, advertiserId);

      const price = parsePrice(card.priceNumber);
      await insertPriceHistory(zapListingId, price);

      await insertPropertyMatch(dnaRow.id, zapListingId, property, card, runId);
    } catch (err) {
      console.error(
        `Erro ao salvar card da Zap para DNA ID ${property.dna_id}:`,
        err
      );
    }
  }
}
