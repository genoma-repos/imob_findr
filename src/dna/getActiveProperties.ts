// src/dna/getActiveProperties.ts
import { supabase } from '../db/supabaseClient';
import { Property } from '../types';

export async function getActiveProperties(limit = 10): Promise<Property[]> {
  const { data, error } = await supabase
    .from('dna_properties')
    .select('*')
    .eq('active', true)
    .order('id', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Erro ao buscar imóveis ativos:', error);
    throw error;
  }

  return (data ?? []) as Property[];
}
