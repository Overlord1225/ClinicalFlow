// js/supabaseClient.js
const SUPABASE_URL = 'https://eszyqbkbxngpjwrpfdwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fapdAU8hGZmp4SMv1aYCVQ_JlClfC_s';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
