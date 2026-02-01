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

const DISCORD_API = 'https://discord.com/api/v10';

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

// Moderation command handlers
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

async function handleUnmute(interaction: any) {
  const guildId = interaction.guild_id;
  const targetId = getOption(interaction.data.options, 'membre') as string;

  const res = await discordFetch(`/guilds/${guildId}/members/${targetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ communication_disabled_until: null })
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de unmute cet utilisateur.`);
  }

  return publicMsg(`✅ <@${targetId}> a été unmute.`);
}

async function handleClear(interaction: any) {
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

  return ephemeral(`✅ ${toDelete.length} message(s) supprimé(s).`);
}

async function handleLock(interaction: any) {
  const guildId = interaction.guild_id;
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;

  // Get @everyone role (same ID as guild)
  const everyoneRoleId = guildId;

  const res = await discordFetch(`/channels/${channelId}/permissions/${everyoneRoleId}`, {
    method: 'PUT',
    body: JSON.stringify({ type: 0, deny: '2048' }) // SEND_MESSAGES
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de verrouiller le salon.`);
  }

  return publicMsg(`🔒 Le salon <#${channelId}> a été verrouillé.`);
}

async function handleUnlock(interaction: any) {
  const guildId = interaction.guild_id;
  const channelId = getOption(interaction.data.options, 'salon') as string || interaction.channel_id;
  const everyoneRoleId = guildId;

  const res = await discordFetch(`/channels/${channelId}/permissions/${everyoneRoleId}`, {
    method: 'PUT',
    body: JSON.stringify({ type: 0, deny: '0' })
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de déverrouiller le salon.`);
  }

  return publicMsg(`🔓 Le salon <#${channelId}> a été déverrouillé.`);
}

async function handleAddRole(interaction: any) {
  const guildId = interaction.guild_id;
  const memberId = getOption(interaction.data.options, 'membre') as string;
  const roleId = getOption(interaction.data.options, 'role') as string;

  const res = await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
    method: 'PUT'
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible d'ajouter le rôle.`);
  }

  return publicMsg(`✅ Le rôle <@&${roleId}> a été ajouté à <@${memberId}>.`);
}

async function handleDelRole(interaction: any) {
  const guildId = interaction.guild_id;
  const memberId = getOption(interaction.data.options, 'membre') as string;
  const roleId = getOption(interaction.data.options, 'role') as string;

  const res = await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    return ephemeral(`❌ Impossible de retirer le rôle.`);
  }

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

// Handle help command
function handleHelp(interaction: any) {
  const embeds = [
    {
      title: "📖 Liste des commandes",
      description: "Les paramètres entre `<>` sont obligatoires, ceux entre `[]` sont facultatifs.",
      color: 0x2B2D31,
      fields: [],
      footer: { text: `Demandé par ${interaction.member?.user?.username || 'Utilisateur'}` },
      timestamp: new Date().toISOString()
    },
    {
      title: "🛡️ Modération",
      color: 0xEF4444,
      fields: [
        { name: "`/ban <membre> [raison]`", value: "Bannir un utilisateur du serveur", inline: false },
        { name: "`/unban <user_id>`", value: "Débannir un utilisateur", inline: false },
        { name: "`/kick <membre> [raison]`", value: "Expulser un utilisateur du serveur", inline: false },
        { name: "`/mute <membre> <durée> [raison]`", value: "Rendre muet un utilisateur (timeout)", inline: false },
        { name: "`/unmute <membre>`", value: "Retirer le mute d'un utilisateur", inline: false },
        { name: "`/warn <membre> <raison>`", value: "Avertir un utilisateur", inline: false },
        { name: "`/clear <nombre> [membre]`", value: "Supprimer des messages (1-100)", inline: false },
        { name: "`/lock [salon]`", value: "Verrouiller un salon", inline: false },
        { name: "`/unlock [salon]`", value: "Déverrouiller un salon", inline: false },
        { name: "`/addrole <membre> <role>`", value: "Ajouter un rôle à un membre", inline: false },
        { name: "`/delrole <membre> <role>`", value: "Retirer un rôle d'un membre", inline: false },
        { name: "`/sanctions <membre>`", value: "Voir les sanctions d'un utilisateur", inline: false },
        { name: "`/sanctions-clear <membre>`", value: "Supprimer les sanctions d'un membre", inline: false },
        { name: "`/banlist`", value: "Voir la liste des utilisateurs bannis", inline: false },
        { name: "`/mutelist`", value: "Voir la liste des utilisateurs en timeout", inline: false },
      ]
    },
    {
      title: "⚙️ Gestion du serveur",
      color: 0x3B82F6,
      fields: [
        { name: "`/massiverole <role>`", value: "Ajouter un rôle à tous les membres du serveur", inline: false },
        { name: "`/unmassiverole <role>`", value: "Retirer un rôle de tous les membres du serveur", inline: false },
        { name: "`/renew [salon]`", value: "Recréer un salon (le supprimer et le recréer identique)", inline: false },
        { name: "`/embed <titre> <description> [couleur]`", value: "Créer un embed personnalisé", inline: false },
        { name: "`/bringall <salon>`", value: "Déplacer tous les utilisateurs d'un vocal vers un autre", inline: false },
        { name: "`/serverinfo`", value: "Affiche les informations du serveur", inline: false },
        { name: "`/userinfo [membre]`", value: "Affiche les informations d'un utilisateur", inline: false },
        { name: "`/roleinfo <role>`", value: "Affiche les informations d'un rôle", inline: false },
      ]
    },
    {
      title: "🔧 Utilitaires",
      color: 0x22C55E,
      fields: [
        { name: "`/say <message>`", value: "Envoyer un message via le bot", inline: false },
        { name: "`/stats`", value: "Afficher les statistiques en temps réel", inline: false },
        { name: "`/help`", value: "Afficher cette aide", inline: false },
      ]
    }
  ];

  return publicMsg('', embeds);
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
        case 'unmute': return handleUnmute(interaction);
        case 'clear': return handleClear(interaction);
        case 'lock': return handleLock(interaction);
        case 'unlock': return handleUnlock(interaction);
        case 'addrole': return handleAddRole(interaction);
        case 'delrole': return handleDelRole(interaction);
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

        default:
          return ephemeral("❌ Commande inconnue.");
      }
    } catch (error) {
      console.error('Command error:', error);
      return ephemeral(`❌ Une erreur est survenue.`);
    }
  }

  // Handle button interactions
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id;
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
