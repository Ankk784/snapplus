import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const DISCORD_APPLICATION_ID = Deno.env.get('DISCORD_APPLICATION_ID');
    
    if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
      throw new Error('Missing Discord configuration');
    }

    // Define slash commands
    const commands = [
      {
        name: 'say',
        description: 'Envoie un message dans le salon',
        options: [
          {
            name: 'message',
            description: 'Le message à envoyer',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'stats',
        description: 'Affiche les statistiques en temps réel'
      },
      // --- MODERATION COMMANDS ---
      {
        name: 'ban',
        description: 'Bannir un utilisateur du serveur',
        default_member_permissions: '4', // BAN_MEMBERS
        options: [
          { name: 'membre', description: 'L\'utilisateur à bannir', type: 6, required: true },
          { name: 'raison', description: 'Raison du ban', type: 3, required: false }
        ]
      },
      {
        name: 'unban',
        description: 'Débannir un utilisateur',
        default_member_permissions: '4',
        options: [
          { name: 'user_id', description: 'ID de l\'utilisateur à débannir', type: 3, required: true }
        ]
      },
      {
        name: 'kick',
        description: 'Expulser un utilisateur du serveur',
        default_member_permissions: '2', // KICK_MEMBERS
        options: [
          { name: 'membre', description: 'L\'utilisateur à expulser', type: 6, required: true },
          { name: 'raison', description: 'Raison de l\'expulsion', type: 3, required: false }
        ]
      },
      {
        name: 'mute',
        description: 'Rendre muet un utilisateur (timeout)',
        default_member_permissions: '1099511627776', // MODERATE_MEMBERS
        options: [
          { name: 'membre', description: 'L\'utilisateur à mute', type: 6, required: true },
          { name: 'duree', description: 'Durée (ex: 10m, 1h, 1d)', type: 3, required: true },
          { name: 'raison', description: 'Raison du mute', type: 3, required: false }
        ]
      },
      {
        name: 'unmute',
        description: 'Retirer le mute d\'un utilisateur',
        default_member_permissions: '1099511627776',
        options: [
          { name: 'membre', description: 'L\'utilisateur à unmute', type: 6, required: true }
        ]
      },
      {
        name: 'clear',
        description: 'Supprimer des messages dans le salon',
        default_member_permissions: '8192', // MANAGE_MESSAGES
        options: [
          { name: 'nombre', description: 'Nombre de messages à supprimer (1-100)', type: 4, required: true },
          { name: 'membre', description: 'Filtrer par utilisateur', type: 6, required: false }
        ]
      },
      {
        name: 'lock',
        description: 'Verrouiller un salon',
        default_member_permissions: '16', // MANAGE_CHANNELS
        options: [
          { name: 'salon', description: 'Salon à verrouiller (défaut: actuel)', type: 7, required: false }
        ]
      },
      {
        name: 'unlock',
        description: 'Déverrouiller un salon',
        default_member_permissions: '16',
        options: [
          { name: 'salon', description: 'Salon à déverrouiller (défaut: actuel)', type: 7, required: false }
        ]
      },
      {
        name: 'addrole',
        description: 'Ajouter un rôle à un membre',
        default_member_permissions: '268435456', // MANAGE_ROLES
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true },
          { name: 'role', description: 'Le rôle à ajouter', type: 8, required: true }
        ]
      },
      {
        name: 'delrole',
        description: 'Retirer un rôle d\'un membre',
        default_member_permissions: '268435456',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true },
          { name: 'role', description: 'Le rôle à retirer', type: 8, required: true }
        ]
      },
      {
        name: 'sanctions',
        description: 'Voir les sanctions d\'un utilisateur',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true }
        ]
      },
      {
        name: 'banlist',
        description: 'Voir la liste des utilisateurs bannis',
        default_member_permissions: '4'
      },
      {
        name: 'mutelist',
        description: 'Voir la liste des utilisateurs en timeout',
        default_member_permissions: '1099511627776'
      },
      {
        name: 'warn',
        description: 'Avertir un utilisateur',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur à avertir', type: 6, required: true },
          { name: 'raison', description: 'Raison de l\'avertissement', type: 3, required: true }
        ]
      },
      {
        name: 'sanctions-clear',
        description: 'Supprimer les sanctions d\'un membre',
        default_member_permissions: '8', // ADMINISTRATOR
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true }
        ]
      }
    ];

    // Register commands globally
    const response = await fetch(
      `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commands)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord API error:', errorText);
      throw new Error(`Discord API error: ${response.status}`);
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Commands registered successfully',
      commands: data 
    }), {
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
