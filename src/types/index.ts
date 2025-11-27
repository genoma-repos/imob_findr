
export type Property = {
  id: number;
  dna_id: string; // Código do imóvel na DNA
  title: string;
  type: string; // "apartamento", "casa", etc.
  area_m2: number; // Área em metros quadrados
  bedrooms: number; // Quantidade de quartos
  bathrooms: number; // Quantidade de banheiros
  parking_spaces: number; // Vagas de garagem
  street: string; // "Rua Real Grandeza"
  neighborhood: string; // "Botafogo"
  city: string; // "Rio de Janeiro"
  price: number; // Preço em R$
  url_dna: string; // URL do imóvel no DNA
  active: boolean; // Se o imóvel está ativo para scrapping
  last_synced_at: string;
  last_scraped_at: string | null;
  last_scrape_status: string | null;
};

export type ZapPropertyCard = {
  href: string | null;
  title: string | null;
  locationText: string;
  streetText: string;
  priceNumber: string;
  sellerName: string | null; // << NOVO
  advertiserCode: string | null;     // "NBAP12462"
  zapCode: string | null;            // "2830072830"
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
};