import 'dotenv/config';
import { Property } from './types';
import { supabase } from './db/supabaseClient';
import { getNextActiveProperty } from './dna/getNextProperty';
import { scrapeZapForProperty } from './scrapers/zap/scrapeZapForProperty';
import { saveZapResultsForProperty } from './scrapers/zap/saveZapResults';
import { getActiveProperties } from './dna/getActiveProperties';

async function runBatch(limit = 5) {
  // 1) Buscar imóveis ativos da DNA
  const properties: Property[] = await getActiveProperties(limit);

  if (!properties.length) {
    console.log('Nenhum imóvel ativo encontrado em dna_properties.');
    return;
  }

  // 2) Criar uma scrape_run
  const { data: run, error: runError } = await supabase
    .from('scrape_runs')
    .insert({
      status: 'running',
      total_properties: properties.length,
      processed_count: 0,
      notes: `Execução simples em lote (${properties.length} imóveis)`,
    })
    .select('id')
    .single();

  if (runError) {
    console.error('Erro ao criar scrape_run:', runError);
    throw runError;
  }

  const runId = run.id as number;
  console.log(`🚀 Iniciando scrape_run #${runId} para ${properties.length} imóveis.`);

  let processedCount = 0;

  // 3) Processar imóvel a imóvel
  for (const property of properties) {
    if (!property.id) {
      console.warn(
        `Imóvel da DNA com dna_id=${property.dna_id} não tem id na tabela dna_properties, pulando.`
      );
      continue;
    }

    console.log(`\n🏠 Processando DNA ID: ${property.dna_id} (row id=${property.id})`);

    // 3.1) Criar job para esse imóvel
    const { data: jobRow, error: jobError } = await supabase
      .from('property_scrape_jobs')
      .insert({
        run_id: runId,
        dna_property_id: property.id,
        status: 'running',
        attempts: 1,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Erro ao criar property_scrape_job:', jobError);
      continue;
    }

    const jobId = jobRow.id as number;

    try {
      // 3.2) Rodar scraping na Zap
      const zapCards = await scrapeZapForProperty(property);
      console.log(`🔎 Encontrados ${zapCards.length} anúncios na Zap.`);

      // 3.3) Salvar resultados no Supabase (advertisers, listings, prices, matches)
      await saveZapResultsForProperty(property, zapCards, runId);

      // 3.4) Atualizar job como sucesso
      await supabase
        .from('property_scrape_jobs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      // 3.5) Atualizar dna_properties (último scrape)
      await supabase
        .from('dna_properties')
        .update({
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: 'success',
        })
        .eq('id', property.id);

      console.log(`✅ Sucesso para DNA ${property.dna_id}`);
    } catch (err: any) {
      console.error(`❌ Erro ao processar DNA ${property.dna_id}:`, err);

      // Atualiza job como erro
      await supabase
        .from('property_scrape_jobs')
        .update({
          status: 'error',
          error_message: String(err?.message ?? err),
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      // Atualiza dna_properties
      await supabase
        .from('dna_properties')
        .update({
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: 'error',
        })
        .eq('id', property.id);
    }

    // 3.6) Incrementa progresso da run
    processedCount += 1;
    await supabase
      .from('scrape_runs')
      .update({
        processed_count: processedCount,
      })
      .eq('id', runId);
  }

  // 4) Finalizar run
  await supabase
    .from('scrape_runs')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId);

  console.log(`\n🏁 scrape_run #${runId} finalizada. Processados: ${processedCount}.`);
}

async function main() {
  // ajusta o número de imóveis por rodada pra testar
  await runBatch(10);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
