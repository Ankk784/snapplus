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
            type: 3, // STRING type
            required: true
          }
        ]
      },
      {
        name: 'stats',
        description: 'Affiche les statistiques en temps réel'
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
