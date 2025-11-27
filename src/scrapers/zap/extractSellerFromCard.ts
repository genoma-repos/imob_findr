import { Locator } from 'patchright';
import { Page } from 'patchright';

export async function extractSellerFromCard(
  card: Locator,
  page: Page
): Promise<{
  sellerName: string | null;
  advertiserCode: string | null;
  zapCode: string | null;
  isDeduplicated: boolean;
  deduplicatedOffersCount: number | null;
}> {
  const phoneButton = card.locator('[data-cy="rp-cardProperty-phone-btn"]');
  const dedupButton = card.locator('[data-cy="listing-card-deduplicated-button"]');

  const hasPhone = await phoneButton.isVisible().catch(() => false);
  const hasDedup = await dedupButton.isVisible().catch(() => false);

  // 🔹 CASO 1: card normal com botão "Telefone"
  if (hasPhone) {
    await phoneButton.scrollIntoViewIfNeeded();
    await phoneButton.evaluate((btn: HTMLElement) => btn.click());

    const modal = page.locator('[data-cy="contact-dialog"]').first();
    await modal.waitFor({ state: 'visible', timeout: 10000 });

    const sellerName = await modal
      .locator('.ListingInfoSection-module__3f6Rqq__title')
      .innerText()
      .then((t) => t.trim())
      .catch(() => null);

    const infoLines =
      (await modal
        .locator(
          '.ListingInfoSection-module__3f6Rqq__additionalInfo .ListingInfoSection-module__3f6Rqq__info'
        )
        .allInnerTexts()
        .catch(() => [])) || [];

    let advertiserCode: string | null = null;
    let zapCode: string | null = null;

    for (const line of infoLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('No anunciante:')) {
        advertiserCode = trimmed.replace('No anunciante:', '').trim();
      }
      if (trimmed.startsWith('No Zap:')) {
        zapCode = trimmed.replace('No Zap:', '').trim();
      }
    }

    await page.keyboard.press('Escape').catch(() => {});
    // await page.waitForTimeout(300);
    await modal.waitFor({ state: 'hidden', timeout: 500 }).catch(() => {});

    return {
      sellerName,
      advertiserCode,
      zapCode,
      isDeduplicated: false,
      deduplicatedOffersCount: null,
    };
  }

  // 🔹 CASO 2: card deduplicado ("Ver os 2 anúncios deste imóvel")
  if (hasDedup) {
    const text = (await dedupButton.innerText().catch(() => '')).trim();
    // Ex.: "Ver os 2 anúncios deste imóvel" → pega o 2
    const match = text.match(/(\d+)/);
    const count = match ? Number(match[1]) : null;

    // Aqui eu só marco como deduplicado e deixo os campos de vendedor nulos.
    // Mais tarde podemos criar uma rotina específica pra entrar no dedup
    // e pegar cada anúncio separadamente.
    return {
      sellerName: null,
      advertiserCode: null,
      zapCode: null,
      isDeduplicated: true,
      deduplicatedOffersCount: count,
    };
  }

  // 🔹 CASO 3: nem telefone nem deduplicado (mais raro, mas pode acontecer)
  return {
    sellerName: null,
    advertiserCode: null,
    zapCode: null,
    isDeduplicated: false,
    deduplicatedOffersCount: null,
  };
}
