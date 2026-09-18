import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a shared secret (set CALLBACK_SECRET in Supabase secrets).
    // Header only: X-Callback-Secret (jamais dans l'URL, sinon il finit dans les logs).
    const expectedSecret = Deno.env.get('CALLBACK_SECRET');
    if (!expectedSecret) {
      console.error('[submission-callback] CALLBACK_SECRET not configured');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const providedSecret = req.headers.get('x-callback-secret') || '';

    if (providedSecret !== expectedSecret) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const id = url.searchParams.get('id') || '';
    const action = url.searchParams.get('action') || '';

    if (!UUID_RE.test(id) || (action !== 'approve' && action !== 'reject')) {
      return new Response('Invalid request', { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error } = await supabase
      .from('submissions')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('[submission-callback] DB error:', error);
      return new Response('Server error', { status: 500, headers: corsHeaders });
    }

    const message = action === 'approve'
      ? '✅ Soumission approuvée avec succès!'
      : '❌ Soumission refusée.';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Modération</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white; }
            .container { text-align: center; padding: 40px; background: #16213e; border-radius: 16px; }
            h1 { color: ${action === 'approve' ? '#22c55e' : '#ef4444'}; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${message}</h1>
            <p>Vous pouvez fermer cette page.</p>
          </div>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('[submission-callback] Error:', error);
    return new Response('Server error', { status: 500, headers: corsHeaders });
  }
});
