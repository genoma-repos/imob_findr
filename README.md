---

## 📦 Stack

- **Node.js + TypeScript**
- **Scraping:** Playwright via [`patchright`]
- **Banco:** Supabase (PostgreSQL)
- **Cliente DB:** `@supabase/supabase-js`

---

## 🔧 Configuração do projeto

### 1. Instalar dependências

```
npm install
npm run dev
```

### 2. Variáveis de ambiente

Criar um arquivo .env na raiz:

SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_KEY=chave_service_role_aqui


Usar a service_role key do Supabase (Settings → API), pois o worker roda no backend e precisa ignorar RLS se estiver ativo.

### 3. Estrutura de pastas
```
src/
  index.ts                    # Orquestrador: roda o batch de scraping

  types/
    index.ts                  # Tipos Property, ZapPropertyCard, etc.

  db/
    supabaseClient.ts         # Conexão com Supabase

  dna/
    getActiveProperties.ts    # Busca imóveis ativos da DNA (dna_properties)

  zap/
    getZapUrl.ts              # Gera URL de busca na Zap a partir do imóvel DNA
    scrapeZapForProperty.ts   # Faz scraping da página de resultados da Zap
    extractSellerFromCard.ts  # Extrai anunciante/códigos de cada card
    saveZapResults.ts         # Persiste anúncios, anunciantes, preços, matches

  utils/
    parsePrice.ts             # Converte texto de preço → number
    normalizeName.ts          # Normaliza strings p/ comparação (rua, nome, etc.)
```

