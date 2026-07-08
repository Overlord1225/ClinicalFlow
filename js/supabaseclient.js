// js/supabaseClient.js
const SUPABASE_URL = 'https://eszyqbkbxngpjwrpfdwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzenlxYmtieG5ncGp3cnBmZHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMTE0MjYsImV4cCI6MjA5ODg4NzQyNn0.jrC2xf6XIeTDUH61xHMQp9a2xN1mbPmZ81dSbKntgJ4';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
