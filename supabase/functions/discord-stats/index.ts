import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatUptime(startDate: Date): string {
  const now = new Date();
  const diff = now.getTime() - startDate.getTime();
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}j ${hours}h ${minutes}m`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' ' + date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

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

    // Récupérer les statistiques
    const [
      { count: totalVisits },
      { data: lastVisit },
      { count: totalSubmissions },
      { data: lastSubmission },
      { count: codesSubmitted },
      { count: codesApproved },
      { count: codesRejected },
      { data: statsConfig }
    ] = await Promise.all([
      supabase.from('visits').select('*', { count: 'exact', head: true }),
      supabase.from('visits').select('visited_at').order('visited_at', { ascending: false }).limit(1).single(),
      supabase.from('submissions').select('*', { count: 'exact', head: true }),
      supabase.from('submissions').select('created_at').order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).not('code', 'is', null),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('stats_config').select('*').eq('id', 'main').single()
    ]);

    const now = new Date();
    const startedAt = statsConfig?.started_at ? new Date(statsConfig.started_at) : now;
    
    // Calculer les pourcentages
    const totalCodes = codesSubmitted || 0;
    const approvedPercent = totalCodes > 0 ? ((codesApproved || 0) / totalCodes * 100).toFixed(1) : '0.0';
    const rejectedPercent = totalCodes > 0 ? ((codesRejected || 0) / totalCodes * 100).toFixed(1) : '0.0';

    // Construire l'embed
    const embed = {
      title: "📊 Statistiques en temps réel - Snap+",
      color: 0x2B2D31,
      fields: [
        {
          name: "👥 Visiteurs",
          value: [
            `🌐 **Total des visites:** ${totalVisits || 0}`,
            `👁️ **Visiteurs actuels:** 0`,
            `🕐 **Dernière visite:** ${lastVisit?.visited_at ? formatDateTime(new Date(lastVisit.visited_at)) : 'Aucune'}`
          ].join('\n'),
          inline: false
        },
        {
          name: "📝 Inscriptions",
          value: [
            `📋 **Total inscriptions:** ${totalSubmissions || 0}`,
            `🕐 **Dernière inscription:** ${lastSubmission?.created_at ? formatDateTime(new Date(lastSubmission.created_at)) : 'Aucune'}`
          ].join('\n'),
          inline: false
        },
        {
          name: "🔐 Codes de vérification",
          value: [
            `📤 **Codes soumis:** ${codesSubmitted || 0}`,
            `✅ **Codes acceptés:** ${codesApproved || 0} (${approvedPercent}%)`,
            `❌ **Codes rejetés:** ${codesRejected || 0} (${rejectedPercent}%)`
          ].join('\n'),
          inline: false
        },
        {
          name: "⚙️ Système",
          value: [
            `🟢 **Uptime:** ${formatUptime(startedAt)}`,
            `🔄 **Dernière mise à jour:** ${formatDateTime(now)}`
          ].join('\n'),
          inline: false
        }
      ],
      footer: {
        text: `🔄 Actualisation automatique toutes les 30 secondes • Aujourd'hui à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      }
    };

    let messageId = statsConfig?.stats_message_id;

    if (messageId) {
      // Éditer le message existant
      const response = await fetch(
        `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages/${messageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ embeds: [embed] })
        }
      );

      if (!response.ok) {
        // Si le message n'existe plus, en créer un nouveau
        if (response.status === 404) {
          messageId = null;
        } else {
          const errorText = await response.text();
          console.error('Discord API error:', errorText);
        }
      }
    }

    if (!messageId) {
      // Créer un nouveau message
      const response = await fetch(
        `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ embeds: [embed] })
        }
      );

      if (response.ok) {
        const data = await response.json();
        messageId = data.id;

        // Sauvegarder l'ID du message
        await supabase
          .from('stats_config')
          .update({ 
            stats_message_id: messageId,
            stats_channel_id: DISCORD_CHANNEL_ID,
            last_update: now.toISOString()
          })
          .eq('id', 'main');
      } else {
        const errorText = await response.text();
        console.error('Discord API error:', errorText);
        throw new Error(`Discord API error: ${response.status}`);
      }
    } else {
      // Mettre à jour last_update
      await supabase
        .from('stats_config')
        .update({ last_update: now.toISOString() })
        .eq('id', 'main');
    }

    return new Response(JSON.stringify({ success: true, messageId }), {
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
