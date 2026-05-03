// Client Supabase partagé.
// Ces deux valeurs sont publiques par design — la sécurité repose sur Auth + RLS côté Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://giccgdabfwxkgdzzvgva.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpY2NnZGFiZnd4a2dkenp2Z3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3Njg4ODUsImV4cCI6MjA5MzM0NDg4NX0.BlAwLtPESVTF7CRv6Nrqs1VpGgApPqYlOTM7SH3vCrY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function roleOf(user) {
  return user?.user_metadata?.role ?? 'visitor';
}
