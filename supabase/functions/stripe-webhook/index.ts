import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Price ID to plan type mapping
const PRICE_TO_PLAN: Record<string, { plan: string; days: number | null }> = {
  "price_1Sw28LDjzCKUlNssSDiXSoC5": { plan: "standard", days: 30 },
  "price_1Sw28bDjzCKUlNssT6OG8h18": { plan: "premium", days: 90 },
  "price_1Sw28qDjzCKUlNssNbTClXyy": { plan: "lifetime", days: null },
};

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) key += '-';
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return key;
}

async function sendDiscordDM(discordUserId: string, licenseKey: string, planType: string): Promise<boolean> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    console.error("DISCORD_BOT_TOKEN not set");
    return false;
  }

  try {
    // Create DM channel
    const dmChannelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });

    if (!dmChannelRes.ok) {
      console.error("Failed to create DM channel:", await dmChannelRes.text());
      return false;
    }

    const dmChannel = await dmChannelRes.json();

    // Send license key
    const planNames: Record<string, string> = {
      standard: "Standard (1 mois)",
      premium: "Premium (3 mois)",
      lifetime: "Lifetime (à vie)",
    };

    const embed = {
      title: "🎉 Merci pour ton achat !",
      description: "Voici ta clé de licence pour Protect Bot.",
      color: 0x00ff00,
      fields: [
        {
          name: "📦 Plan",
          value: planNames[planType] || planType,
          inline: true,
        },
        {
          name: "🔑 Clé de licence",
          value: `\`\`\`${licenseKey}\`\`\``,
          inline: false,
        },
        {
          name: "📝 Instructions",
          value: "Utilise `/license activate <clé>` sur ton serveur Discord pour activer ta licence.",
          inline: false,
        },
      ],
      footer: {
        text: "Protect Bot - Merci de ta confiance !",
      },
      timestamp: new Date().toISOString(),
    };

    const messageRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!messageRes.ok) {
      console.error("Failed to send DM:", await messageRes.text());
      return false;
    }

    console.log(`License key sent to Discord user ${discordUserId}`);
    return true;
  } catch (error) {
    console.error("Error sending Discord DM:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  try {
    const body = await req.text();
    let event: Stripe.Event;

    // Verify webhook signature if secret is set
    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
    }

    console.log(`Received Stripe event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get Discord user ID from metadata
      const discordUserId = session.metadata?.discord_user_id;
      if (!discordUserId) {
        console.error("No discord_user_id in session metadata");
        return new Response(JSON.stringify({ error: "Missing discord_user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get line items to determine plan
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      if (lineItems.data.length === 0) {
        console.error("No line items found");
        return new Response(JSON.stringify({ error: "No line items" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const priceId = lineItems.data[0].price?.id;
      if (!priceId || !PRICE_TO_PLAN[priceId]) {
        console.error(`Unknown price ID: ${priceId}`);
        return new Response(JSON.stringify({ error: "Unknown price" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { plan, days } = PRICE_TO_PLAN[priceId];

      // Generate license key
      const licenseKey = generateLicenseKey();

      // Save to database
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error: insertError } = await supabase.from("valid_licenses").insert({
        license_key: licenseKey,
        plan_type: plan,
        duration_days: days,
        redeemed: false,
      });

      if (insertError) {
        console.error("Failed to insert license:", insertError);
        return new Response(JSON.stringify({ error: "Database error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send license via Discord DM
      const dmSent = await sendDiscordDM(discordUserId, licenseKey, plan);
      
      if (!dmSent) {
        console.warn(`Could not send DM to ${discordUserId}, but license was created`);
      }

      console.log(`License ${licenseKey} created for Discord user ${discordUserId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Webhook error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
