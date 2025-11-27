import { chromium, Page, Browser } from 'patchright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36',
];

function getRandomUserAgent() {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

export async function getPage(): Promise<{ page: Page; browser: Browser }> {
  const ua = getRandomUserAgent();
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      // '--single-process', // não funciona bem no Windows, melhor remover
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    userAgent: ua,
    locale: 'pt-BR',
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const page = await context.newPage();
  return { page, browser };
}