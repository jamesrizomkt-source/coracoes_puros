import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as postgres from "https://deno.land/x/postgres@v0.17.0/mod.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  
  try {
    const { query } = await req.json()
    
    // Fallback if SUPABASE_DB_URL is not set (e.g. older supabase projects)
    const dbUrl = Deno.env.get("SUPABASE_DB_URL") || "postgres://postgres.lmdawrnbnnrnmxbrmgak:Senh@Fort3Git@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

    const pool = new postgres.Pool(dbUrl, 1, true)
    const connection = await pool.connect()
    
    let result
    try {
      result = await connection.queryObject(query)
    } finally {
      connection.release()
    }
    
    return new Response(JSON.stringify({ success: true, rows: result.rows }), { headers: corsHeaders, status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
