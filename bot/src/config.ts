import dotenv from 'dotenv';
dotenv.config();

export const config = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN!,
  DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID!,
  DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || '',
  DISCORD_STATS_CHANNEL_ID: process.env.DISCORD_STATS_CHANNEL_ID || '',
  CREATEURS: (process.env.CREATEURS || '').split(',').filter(Boolean),
};
