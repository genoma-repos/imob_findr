import { supabase } from '../db/supabaseClient';

export async function getNextActiveProperty() {
  const { data, error } = await supabase
    .from('dna_properties')
    .select('*')
    .eq('active', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
