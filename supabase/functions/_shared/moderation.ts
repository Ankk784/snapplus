import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = 'https://discord.com/api/v10';

// Parse duration string to milliseconds
export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)(m|h|d|j)$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd':
    case 'j': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// Format duration for display
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  
  if (days > 0) return `${days} jour(s)`;
  if (hours > 0) return `${hours} heure(s)`;
  return `${minutes} minute(s)`;
}

// Discord API helper
export async function discordFetch(endpoint: string, options: RequestInit = {}) {
  const token = Deno.env.get('DISCORD_BOT_TOKEN');
  const response = await fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return response;
}

// Get Supabase client
export function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Log sanction to database
export async function logSanction(data: {
  guild_id: string;
  user_id: string;
  moderator_id: string;
  type: 'ban' | 'kick' | 'mute' | 'warn';
  reason?: string;
  duration?: string;
  expires_at?: Date;
}) {
  const supabase = getSupabase();
  await supabase.from('sanctions').insert({
    guild_id: data.guild_id,
    user_id: data.user_id,
    moderator_id: data.moderator_id,
    type: data.type,
    reason: data.reason || null,
    duration: data.duration || null,
    expires_at: data.expires_at?.toISOString() || null,
    active: true
  });
}

// Create embed for moderation action
export function createModEmbed(options: {
  action: string;
  target: { id: string; username: string };
  moderator: { id: string; username: string };
  reason?: string;
  duration?: string;
  success: boolean;
  color?: number;
}) {
  const { action, target, moderator, reason, duration, success, color } = options;
  const emoji = success ? '✅' : '❌';
  const embedColor = color || (success ? 0x22C55E : 0xEF4444);
  
  return {
    title: `${emoji} ${action}`,
    color: embedColor,
    fields: [
      { name: '👤 Utilisateur', value: `<@${target.id}> (${target.username})`, inline: true },
      { name: '👮 Modérateur', value: `<@${moderator.id}>`, inline: true },
      ...(reason ? [{ name: '📝 Raison', value: reason, inline: false }] : []),
      ...(duration ? [{ name: '⏱️ Durée', value: duration, inline: true }] : [])
    ],
    timestamp: new Date().toISOString()
  };
}

// Response helper
export const RESPONSE_TYPE = {
  CHANNEL_MESSAGE: 4,
  DEFERRED: 5,
  UPDATE_MESSAGE: 7
};

export function ephemeralResponse(content: string, embeds?: unknown[]) {
  return {
    type: RESPONSE_TYPE.CHANNEL_MESSAGE,
    data: {
      content,
      embeds,
      flags: 64
    }
  };
}

export function publicResponse(content: string, embeds?: unknown[]) {
  return {
    type: RESPONSE_TYPE.CHANNEL_MESSAGE,
    data: {
      content,
      embeds
    }
  };
}
