import { config } from '../config';

const DISCORD_API = 'https://discord.com/api/v10';

export function isCreateur(userId: string): boolean {
  return config.CREATEURS.includes(userId);
}

export async function discordFetch(endpoint: string, options: RequestInit = {}) {
  return fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bot ${config.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    }
  });
}

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

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days > 0) return `${days} jour(s)`;
  if (hours > 0) return `${hours} heure(s)`;
  return `${minutes} minute(s)`;
}

export function getOption(options: Array<{ name: string; value: unknown }> | undefined, name: string) {
  return options?.find((o: any) => o.name === name)?.value;
}

export function modEmbed(options: {
  action: string;
  targetId: string;
  targetName: string;
  modId: string;
  reason?: string;
  duration?: string;
  success: boolean;
  color?: number;
  extra?: Array<{ name: string; value: string; inline?: boolean }>;
}) {
  const { action, targetId, targetName, modId, reason, duration, success, color, extra } = options;
  return {
    title: `${success ? '✅' : '❌'} ${action}`,
    color: color || (success ? 0x22C55E : 0xEF4444),
    fields: [
      { name: '👤 Utilisateur', value: `<@${targetId}> (${targetName})`, inline: true },
      { name: '👮 Modérateur', value: `<@${modId}>`, inline: true },
      ...(reason ? [{ name: '📝 Raison', value: reason, inline: false }] : []),
      ...(duration ? [{ name: '⏱️ Durée', value: duration, inline: true }] : []),
      ...(extra || [])
    ],
    timestamp: new Date().toISOString()
  };
}

export function logEmbed(options: { title: string; description: string; color?: number; fields?: any[] }) {
  return {
    title: options.title,
    description: options.description,
    color: options.color || 0x2B2D31,
    fields: options.fields || [],
    timestamp: new Date().toISOString(),
  };
}

export async function sendLog(guildId: string, supabase: any, logType: 'mod' | 'raid' | 'msg' | 'role' | 'voice' | 'boost', embed: any) {
  try {
    const columnMap = {
      mod: 'mod_logs_channel_id',
      raid: 'raid_logs_channel_id',
      msg: 'msg_logs_channel_id',
      role: 'role_logs_channel_id',
      voice: 'voice_logs_channel_id',
      boost: 'boost_logs_channel_id',
    } as const;

    const targetColumn = columnMap[logType];

    const { data: config } = await supabase
      .from('guild_config')
      .select(`${targetColumn},logs_channel_id`)
      .eq('guild_id', guildId)
      .single();

    const postToChannel = async (channelId: string) => {
      const res = await discordFetch(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ embeds: [embed] })
      });
      return res.ok;
    };

    const primaryChannelId = config?.[targetColumn] as string | null;
    if (primaryChannelId && await postToChannel(primaryChannelId)) return;

    const fallbackChannelId = config?.logs_channel_id as string | null;
    if (fallbackChannelId && fallbackChannelId !== primaryChannelId) {
      await postToChannel(fallbackChannelId);
    }
  } catch (e) {
    console.error('[LOG] Failed to send log:', e);
  }
}

export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return `PROTECT-${segments.join('-')}`;
}

export async function hasValidLicense(supabase: any, guildId: string): Promise<{ valid: boolean; license?: any }> {
  const { data } = await supabase
    .from('bot_licenses')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .single();
  
  if (!data) return { valid: false };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false };
  return { valid: true, license: data };
}
