import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // IP réelle : cf-connecting-ip est posé par le proxy et n'est pas falsifiable.
    // Sinon on prend la dernière valeur de x-forwarded-for (celle du proxy le plus proche).
    const xff = req.headers.get('x-forwarded-for')?.split(',').map(s => s.trim()).filter(Boolean);
    const clientIp = req.headers.get('cf-connecting-ip') ||
                     (xff && xff.length ? xff[xff.length - 1] : null) ||
                     req.headers.get('x-real-ip') ||
                     'unknown';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if IP is banned
    const { data: bannedIp } = await supabase
      .from('banned_ips')
      .select('*')
      .eq('ip_address', clientIp)
      .maybeSingle();

    return new Response(JSON.stringify({ 
      banned: !!bannedIp,
      reason: bannedIp?.reason || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[check-ip-ban] Error:', error);
    return new Response(JSON.stringify({ banned: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
