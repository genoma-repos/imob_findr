import { buildZapUrlFromProperty } from './getZapUrl';
import { Property, ZapPropertyCard } from '../../types';
import { extractSellerFromCard } from './extractSellerFromCard';
import { getPage } from '../openPage';

export async function scrapeZapForProperty(
  property: Property
): Promise<ZapPropertyCard[]> {
  const { page, browser } = await getPage();

  const results: ZapPropertyCard[] = [];

  try {
    const url = buildZapUrlFromProperty(property);
    console.log('Acessando URL Zap:', url);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // Se não tiver card, esse await vai explodir — tratamos com try/catch
    try {
      await page.waitForSelector('li[data-cy="rp-property-cd"]', {
        timeout: 30_000,
      });
    } catch (err) {
      console.warn(
        `Nenhum card encontrado na Zap para DNA ID: ${property.dna_id}`
      );
      return results;
    }

    const cardsLocator = page.locator('li[data-cy="rp-property-cd"]');
    const count = await cardsLocator.count();

    for (let i = 0; i < count; i++) {
      const card = cardsLocator.nth(i);

      const linkHandle = card.locator('a[role="button"]');

      const [href, title] = await Promise.all([
        linkHandle.getAttribute('href'),
        linkHandle.getAttribute('title'),
      ]);

      const locationText =
        (await card
          .locator('[data-cy="rp-cardProperty-location-txt"]')
          .innerText()
          .catch(() => '')) ?? '';

      const streetText =
        (await card
          .locator('[data-cy="rp-cardProperty-street-txt"]')
          .innerText()
          .catch(() => '')) ?? '';

      const priceText =
        (await card
          .locator('[data-cy="rp-cardProperty-price-txt"]')
          .innerText()
          .catch(() => '')) ?? '';

      const priceNumber = priceText
        ? priceText.split('\n')[0].replace(/[^\d]/g, '')
        : '';

      const {
        sellerName,
        advertiserCode,
        zapCode,
      } = await extractSellerFromCard(card, page);

      const areaM2 = await card
        .locator('[data-cy="rp-cardProperty-propertyArea-txt"]')
        .innerText()
        .then((text) => {
          const match = text.match(/(\d+)\s*m²/);
          return match ? parseInt(match[1], 10) : null;
        })
        .catch(() => null);

      const bedrooms = await card
        .locator('[data-cy="rp-cardProperty-bedroomQuantity-txt"]')
        .innerText()
        .then((text) => {
          const match = text.match(/(\d+)\s*/);
          return match ? parseInt(match[1], 10) : null;
        })
        .catch(() => null);
      
      const bathrooms = await card
        .locator('[data-cy="rp-cardProperty-bathroomQuantity-txt"]')
        .innerText()
        .then((text) => {
          const match = text.match(/(\d+)\s*/);
          return match ? parseInt(match[1], 10) : null;
        })
        .catch(() => null);

      results.push({
        href: href ?? '',
        title: title ?? '',
        locationText,
        streetText,
        priceNumber,
        sellerName,
        advertiserCode,
        zapCode,
        areaM2,
        bedrooms,
        bathrooms,
      });
    }

    console.log(
      `Encontrados ${results.length} imóveis na Zap para o imóvel DNA ID: ${property.dna_id}`
    );
    console.dir(results, { depth: null });

    return results;
  } catch (error) {
    console.error(
      `Erro ao scrappear Zap para DNA ID: ${property.dna_id}`,
      error
    );
    return results;
  } finally {
    await browser.close();
  }
}
