const SUPABASE_URL = "https://ayqzjzzbeiojqztkgtzk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cXpqenpiZWlvanF6dGtndHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzY5ODgsImV4cCI6MjA5NjA1Mjk4OH0.P_VWAc-vTm1zTKJ_jZ-2-FWWWhLBz38NmGq1yyW64K0";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
console.log("Supabase connected:", supabaseClient);