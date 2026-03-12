import { Client, GatewayIntentBits, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { config } from './config';
import { supabase } from './utils/supabase';
import { isCreateur, discordFetch, parseDuration, formatDuration, getOption, modEmbed, logEmbed, sendLog, generateLicenseKey, hasValidLicense } from './utils/helpers';

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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ========== COMMAND HANDLER ==========
client.on('interactionCreate', async (interaction) => {
  // Handle button interactions
  if (interaction.isButton()) {
    const customId = interaction.customId;
    
    // Handle ticket open button
    if (customId === 'open_ticket') {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const subject = 'Support';

      const { data: guildConfig } = await supabase
        .from('guild_config')
        .select('ticket_category_id, ticket_support_role_id')
        .eq('guild_id', guildId)
        .single();

      const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      const permissionOverwrites: any[] = [
        { id: guildId, type: 0, deny: '1024' },
        { id: userId, type: 1, allow: '1024' }
      ];

      if (guildConfig?.ticket_support_role_id) {
        permissionOverwrites.push({ id: guildConfig.ticket_support_role_id, type: 0, allow: '1024' });
      }

      const createRes = await discordFetch(`/guilds/${guildId}/channels`, {
        method: 'POST',
        body: JSON.stringify({
          name: channelName,
          type: 0,
          parent_id: guildConfig?.ticket_category_id || null,
          permission_overwrites: permissionOverwrites
        })
      });

      if (!createRes.ok) {
        await interaction.reply({ content: '❌ Impossible de créer le ticket.', ephemeral: true });
        return;
      }

      const channel = await createRes.json() as any;

      await supabase.from('tickets').insert({
        guild_id: guildId,
        channel_id: channel.id,
        user_id: userId,
        created_by: userId,
        subject,
        status: 'open'
      });

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

      await interaction.reply({ content: `✅ Votre ticket a été créé: <#${channel.id}>`, ephemeral: true });
      return;
    }

    // Handle approve/reject buttons
    if (customId.startsWith('approve_') || customId.startsWith('reject_')) {
      const [action, submissionId] = customId.split('_');
      
      const { data: submission } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (!submission) {
        await interaction.update({ content: '❌ Soumission introuvable.', embeds: [], components: [] });
        return;
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
        description: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${isApproved ? "L'utilisateur a été validé avec succès !" : "La demande a été refusée."}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        color: isApproved ? 0x22C55E : 0xEF4444,
        fields: [
          { name: "👤 Nom d'utilisateur", value: `>>> **${submission.username}**`, inline: false },
          { name: "🔢 Code", value: `\`\`\`fix\n${submission.code || 'N/A'}\n\`\`\``, inline: false },
          { name: "📞 Téléphone", value: `>>> \`🇫🇷 +33 ${formatPhone(submission.phone)}\``, inline: false },
          { name: `${isApproved ? '✅' : '❌'} Décision`, value: `Par <@${interaction.user.id}>`, inline: false },
        ],
        timestamp: new Date().toISOString()
      };

      await interaction.update({ embeds: [updatedEmbed], components: [] });
      return;
    }

    return;
  }

  // Handle select menus
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'help_category') {
      const selectedCategory = interaction.values[0];
      const cat = HELP_CATEGORIES[selectedCategory];
      if (!cat) {
        await interaction.reply({ content: '❌ Catégorie inconnue.', ephemeral: true });
        return;
      }

      const embed = {
        title: `${cat.emoji} ${cat.label}`,
        description: cat.commands,
        color: 0x2B2D31,
        footer: { text: `Demandé par ${interaction.user.username} • Protect Bot` },
        timestamp: new Date().toISOString()
      };

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('help_category')
          .setPlaceholder('📂 Sélectionnez une catégorie')
          .addOptions(Object.entries(HELP_CATEGORIES).map(([key, c]) => ({
            label: c.label,
            value: key,
            description: `Voir les commandes ${c.label.toLowerCase()}`,
            emoji: c.emoji,
            default: key === selectedCategory
          })))
      );

      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    // Handle rolemenu select
    if (interaction.customId === 'rolemenu_select') {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const selectedRoles = interaction.values;

      // Get current member roles
      const memberRes = await discordFetch(`/guilds/${guildId}/members/${userId}`);
      const member = await memberRes.json() as any;
      const currentRoles: string[] = member.roles || [];

      // Get all role options from the select menu
      const allOptionRoles = interaction.component.options.map((o: any) => o.value);

      let added = 0, removed = 0;

      for (const roleId of allOptionRoles) {
        if (selectedRoles.includes(roleId) && !currentRoles.includes(roleId)) {
          await discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' });
          added++;
        } else if (!selectedRoles.includes(roleId) && currentRoles.includes(roleId)) {
          await discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' });
          removed++;
        }
      }

      await interaction.reply({ content: `✅ Rôles mis à jour ! (+${added} / -${removed})`, ephemeral: true });
      return;
    }
  }

  // Handle slash commands
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, user } = interaction;
  const userId = user.id;

  // Free commands (no license required)
  const freeCmds = ['license', 'help', 'ping', 'buy', 'redeem', 'setpaypal', 'setltc', 'setpaypal2', 'setltc2', 'listallowners', 'listallbuyers', 'revoke', 'createlicense', 'listlicenses', 'settoken', 'removetoken', 'banip', 'unbanip', 'listbannedips', 'payment', 'payment2'];

  // Check if command is disabled
  if (guildId && !isCreateur(userId)) {
    const { data: disabledCmd } = await supabase
      .from('disabled_commands')
      .select('*')
      .eq('guild_id', guildId)
      .eq('command_name', commandName)
      .single();
    
    if (disabledCmd) {
      await interaction.reply({ content: `🚫 La commande \`/${commandName}\` est désactivée sur ce serveur.`, ephemeral: true });
      return;
    }
  }

  // Check license
  if (!freeCmds.includes(commandName) && guildId && !isCreateur(userId)) {
    const { valid } = await hasValidLicense(supabase, guildId);
    if (!valid) {
      await interaction.reply({
        embeds: [{
          title: '🔒 Licence Requise',
          description: 'Ce serveur n\'a pas de licence active.',
          color: 0xEF4444,
        }],
        ephemeral: true,
      });
      return;
    }
  }

  try {
    switch (commandName) {
      // ===== HELP =====
      case 'help': {
        const embed = {
          title: '📖 Protect Bot — Aide',
          description: 'Les paramètres entre `<>` sont obligatoires, ceux entre `[]` sont facultatifs.\n\n**Sélectionnez une catégorie ci-dessous** pour voir les commandes disponibles.',
          color: 0x2B2D31,
          fields: Object.entries(HELP_CATEGORIES).map(([, cat]) => ({
            name: `${cat.emoji} ${cat.label}`,
            value: '\u200B',
            inline: true
          })),
          footer: { text: `Demandé par ${user.username}` },
          timestamp: new Date().toISOString()
        };

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('📂 Sélectionnez une catégorie')
            .addOptions(Object.entries(HELP_CATEGORIES).map(([key, cat]) => ({
              label: cat.label,
              value: key,
              description: `Voir les commandes ${cat.label.toLowerCase()}`,
              emoji: cat.emoji
            })))
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        break;
      }

      case 'ping': {
        await interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
        break;
      }

      case 'say': {
        const message = interaction.options.getString('message', true);
        await discordFetch(`/channels/${interaction.channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: message })
        });
        await interaction.reply({ content: '✅ Message envoyé !', ephemeral: true });
        break;
      }

      // ===== MODERATION =====
      case 'ban': {
        const targetId = interaction.options.getUser('membre', true).id;
        const reason = interaction.options.getString('raison') || 'Aucune raison';
        const userRes = await discordFetch(`/users/${targetId}`);
        const targetUser = await userRes.json() as any;

        const banRes = await discordFetch(`/guilds/${guildId}/bans/${targetId}`, {
          method: 'PUT', body: JSON.stringify({ reason })
        });
        if (!banRes.ok) { await interaction.reply({ content: '❌ Impossible de bannir.', ephemeral: true }); break; }

        await supabase.from('sanctions').insert({ guild_id: guildId, user_id: targetId, moderator_id: userId, type: 'ban', reason, active: true });
        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '🔨 Bannissement', description: `<@${userId}> a banni <@${targetId}>`, color: 0xEF4444, fields: [{ name: '📝 Raison', value: reason }] }));
        await interaction.reply({ embeds: [modEmbed({ action: 'Bannissement', targetId, targetName: targetUser.username || targetId, modId: userId, reason, success: true })] });
        break;
      }

      case 'unban': {
        const unbanUserId = interaction.options.getString('user_id', true);
        const res = await discordFetch(`/guilds/${guildId}/bans/${unbanUserId}`, { method: 'DELETE' });
        if (!res.ok) { await interaction.reply({ content: '❌ Impossible de débannir.', ephemeral: true }); break; }
        await interaction.reply(`✅ <@${unbanUserId}> a été débanni.`);
        break;
      }

      case 'kick': {
        const targetId = interaction.options.getUser('membre', true).id;
        const reason = interaction.options.getString('raison') || 'Aucune raison';
        const userRes = await discordFetch(`/users/${targetId}`);
        const targetUser = await userRes.json() as any;

        const kickRes = await discordFetch(`/guilds/${guildId}/members/${targetId}`, { method: 'DELETE' });
        if (!kickRes.ok) { await interaction.reply({ content: '❌ Impossible d\'expulser.', ephemeral: true }); break; }

        await supabase.from('sanctions').insert({ guild_id: guildId, user_id: targetId, moderator_id: userId, type: 'kick', reason, active: false });
        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '👢 Expulsion', description: `<@${userId}> a expulsé <@${targetId}>`, color: 0xF97316, fields: [{ name: '📝 Raison', value: reason }] }));
        await interaction.reply({ embeds: [modEmbed({ action: 'Expulsion', targetId, targetName: targetUser.username || targetId, modId: userId, reason, success: true })] });
        break;
      }

      case 'mute': {
        const targetId = interaction.options.getUser('membre', true).id;
        const durationStr = interaction.options.getString('duree', true);
        const reason = interaction.options.getString('raison') || 'Aucune raison';
        const durationMs = parseDuration(durationStr);
        if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) { await interaction.reply({ content: '❌ Durée invalide (max 28j)', ephemeral: true }); break; }

        const userRes = await discordFetch(`/users/${targetId}`);
        const targetUser = await userRes.json() as any;
        const timeoutUntil = new Date(Date.now() + durationMs).toISOString();

        const muteRes = await discordFetch(`/guilds/${guildId}/members/${targetId}`, { method: 'PATCH', body: JSON.stringify({ communication_disabled_until: timeoutUntil }) });
        if (!muteRes.ok) { await interaction.reply({ content: '❌ Impossible de mute.', ephemeral: true }); break; }

        await supabase.from('sanctions').insert({ guild_id: guildId, user_id: targetId, moderator_id: userId, type: 'mute', reason, duration: durationStr, expires_at: timeoutUntil, active: true });
        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '🔇 Mute', description: `<@${userId}> a mute <@${targetId}> pour ${formatDuration(durationMs)}`, color: 0xF59E0B, fields: [{ name: '📝 Raison', value: reason }] }));
        await interaction.reply({ embeds: [modEmbed({ action: 'Mute', targetId, targetName: targetUser.username || targetId, modId: userId, reason, duration: formatDuration(durationMs), success: true })] });
        break;
      }

      case 'unmute': {
        const targetId = interaction.options.getUser('membre', true).id;
        const res = await discordFetch(`/guilds/${guildId}/members/${targetId}`, { method: 'PATCH', body: JSON.stringify({ communication_disabled_until: null }) });
        if (!res.ok) { await interaction.reply({ content: '❌ Impossible de unmute.', ephemeral: true }); break; }
        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '🔊 Unmute', description: `<@${userId}> a unmute <@${targetId}>`, color: 0x22C55E }));
        await interaction.reply(`✅ <@${targetId}> a été unmute.`);
        break;
      }

      case 'warn': {
        const targetId = interaction.options.getUser('membre', true).id;
        const reason = interaction.options.getString('raison') || 'Aucune raison';
        const userRes = await discordFetch(`/users/${targetId}`);
        const targetUser = await userRes.json() as any;

        await supabase.from('sanctions').insert({ guild_id: guildId, user_id: targetId, moderator_id: userId, type: 'warn', reason, active: true });
        const { count } = await supabase.from('sanctions').select('*', { count: 'exact', head: true }).eq('guild_id', guildId).eq('user_id', targetId).eq('type', 'warn');

        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '⚠️ Avertissement', description: `<@${userId}> a averti <@${targetId}>`, color: 0xF59E0B, fields: [{ name: '📝 Raison', value: reason }, { name: '📊 Total', value: `${count || 1}` }] }));
        await interaction.reply({ embeds: [modEmbed({ action: 'Avertissement', targetId, targetName: targetUser.username || targetId, modId: userId, reason, success: true, color: 0xF59E0B, extra: [{ name: '📊 Total avertissements', value: `${count || 1}`, inline: true }] })] });
        break;
      }

      case 'clear': {
        const count = Math.min(Math.max(interaction.options.getInteger('nombre', true), 1), 100);
        const memberId = interaction.options.getUser('membre')?.id;
        const channelId = interaction.channelId;

        const msgsRes = await discordFetch(`/channels/${channelId}/messages?limit=100`);
        let messages: any[] = await msgsRes.json() as any[];
        if (memberId) messages = messages.filter((m: any) => m.author.id === memberId);

        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const toDelete = messages.filter((m: any) => new Date(m.timestamp).getTime() > twoWeeksAgo).slice(0, count);

        if (toDelete.length === 0) { await interaction.reply({ content: '❌ Aucun message à supprimer.', ephemeral: true }); break; }

        if (toDelete.length === 1) {
          await discordFetch(`/channels/${channelId}/messages/${toDelete[0].id}`, { method: 'DELETE' });
        } else {
          await discordFetch(`/channels/${channelId}/messages/bulk-delete`, { method: 'POST', body: JSON.stringify({ messages: toDelete.map((m: any) => m.id) }) });
        }

        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '🗑️ Clear', description: `<@${userId}> a supprimé ${toDelete.length} messages dans <#${channelId}>`, color: 0x3B82F6 }));
        await interaction.reply({ content: `✅ ${toDelete.length} message(s) supprimé(s).`, ephemeral: true });
        break;
      }

      case 'lock': {
        const channelId = interaction.options.getChannel('salon')?.id || interaction.channelId;
        const res = await discordFetch(`/channels/${channelId}/permissions/${guildId}`, { method: 'PUT', body: JSON.stringify({ type: 0, deny: '2048' }) });
        if (!res.ok) { await interaction.reply({ content: '❌ Impossible de verrouiller.', ephemeral: true }); break; }
        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '🔒 Verrouillage', description: `<@${userId}> a verrouillé <#${channelId}>`, color: 0xEF4444 }));
        await interaction.reply(`🔒 Le salon <#${channelId}> a été verrouillé.`);
        break;
      }

      case 'unlock': {
        const channelId = interaction.options.getChannel('salon')?.id || interaction.channelId;
        const res = await discordFetch(`/channels/${channelId}/permissions/${guildId}`, { method: 'PUT', body: JSON.stringify({ type: 0, deny: '0' }) });
        if (!res.ok) { await interaction.reply({ content: '❌ Impossible de déverrouiller.', ephemeral: true }); break; }
        await sendLog(guildId!, supabase, 'mod', logEmbed({ title: '🔓 Déverrouillage', description: `<@${userId}> a déverrouillé <#${channelId}>`, color: 0x22C55E }));
        await interaction.reply(`🔓 Le salon <#${channelId}> a été déverrouillé.`);
        break;
      }

      case 'addrole': {
        const memberId = interaction.options.getUser('membre', true).id;
        const roleId = interaction.options.getRole('role', true).id;
        const res = await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, { method: 'PUT' });
        if (!res.ok) { await interaction.reply({ content: '❌ Impossible d\'ajouter le rôle.', ephemeral: true }); break; }
        await interaction.reply(`✅ Le rôle <@&${roleId}> a été ajouté à <@${memberId}>.`);
        break;
      }

      case 'delrole': {
        const memberId = interaction.options.getUser('membre', true).id;
        const roleId = interaction.options.getRole('role', true).id;
        const res = await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, { method: 'DELETE' });
        if (!res.ok) { await interaction.reply({ content: '❌ Impossible de retirer le rôle.', ephemeral: true }); break; }
        await interaction.reply(`✅ Le rôle <@&${roleId}> a été retiré de <@${memberId}>.`);
        break;
      }

      case 'sanctions': {
        const targetId = interaction.options.getUser('membre', true).id;
        const { data: sanctions } = await supabase.from('sanctions').select('*').eq('guild_id', guildId).eq('user_id', targetId).order('created_at', { ascending: false }).limit(10);
        if (!sanctions || sanctions.length === 0) { await interaction.reply({ content: `📋 Aucune sanction pour <@${targetId}>.`, ephemeral: true }); break; }
        const list = sanctions.map((s: any, i: number) => {
          const date = new Date(s.created_at).toLocaleDateString('fr-FR');
          const emoji = s.type === 'ban' ? '🔨' : s.type === 'kick' ? '👢' : s.type === 'mute' ? '🔇' : '⚠️';
          return `**${i + 1}.** ${emoji} ${s.type.toUpperCase()} - ${date}\n   └ ${s.reason || 'Aucune raison'}`;
        }).join('\n\n');
        await interaction.reply({ embeds: [{ title: '📋 Sanctions', description: list, color: 0x2B2D31, footer: { text: `Total: ${sanctions.length}` } }], ephemeral: true });
        break;
      }

      case 'sanctions-clear': {
        const targetId = interaction.options.getUser('membre', true).id;
        await supabase.from('sanctions').delete().eq('guild_id', guildId).eq('user_id', targetId);
        await interaction.reply(`✅ Sanctions de <@${targetId}> supprimées.`);
        break;
      }

      case 'banlist': {
        const res = await discordFetch(`/guilds/${guildId}/bans?limit=20`);
        const bans = await res.json() as any[];
        if (!bans || bans.length === 0) { await interaction.reply({ content: '📋 Aucun banni.', ephemeral: true }); break; }
        const list = bans.map((b: any, i: number) => `**${i + 1}.** ${b.user.username} (\`${b.user.id}\`)`).join('\n');
        await interaction.reply({ embeds: [{ title: '🔨 Bannis', description: list, color: 0xEF4444 }], ephemeral: true });
        break;
      }

      case 'mutelist': {
        const res = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
        const members = await res.json() as any[];
        const muted = members.filter((m: any) => m.communication_disabled_until);
        if (muted.length === 0) { await interaction.reply({ content: '📋 Aucun mute.', ephemeral: true }); break; }
        const list = muted.map((m: any, i: number) => `**${i + 1}.** ${m.user.username}`).join('\n');
        await interaction.reply({ embeds: [{ title: '🔇 Mutes', description: list, color: 0xF59E0B }], ephemeral: true });
        break;
      }

      // ===== GESTION =====
      case 'massiverole': {
        const roleId = interaction.options.getRole('role', true).id;
        await interaction.deferReply();
        const res = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
        const members = await res.json() as any[];
        let added = 0;
        for (const m of members) {
          if (!m.roles?.includes(roleId)) {
            const r = await discordFetch(`/guilds/${guildId}/members/${m.user.id}/roles/${roleId}`, { method: 'PUT' });
            if (r.ok) added++;
          }
        }
        await interaction.editReply(`✅ Rôle ajouté à **${added}** membre(s).`);
        break;
      }

      case 'unmassiverole': {
        const roleId = interaction.options.getRole('role', true).id;
        await interaction.deferReply();
        const res = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
        const members = await res.json() as any[];
        let removed = 0;
        for (const m of members) {
          if (m.roles?.includes(roleId)) {
            const r = await discordFetch(`/guilds/${guildId}/members/${m.user.id}/roles/${roleId}`, { method: 'DELETE' });
            if (r.ok) removed++;
          }
        }
        await interaction.editReply(`✅ Rôle retiré de **${removed}** membre(s).`);
        break;
      }

      case 'serverinfo': {
        const [guildRes, channelsRes] = await Promise.all([
          discordFetch(`/guilds/${guildId}?with_counts=true`),
          discordFetch(`/guilds/${guildId}/channels`)
        ]);
        const guild = await guildRes.json() as any;
        const channels = await channelsRes.json() as any[];
        const textCh = channels.filter((c: any) => c.type === 0).length;
        const voiceCh = channels.filter((c: any) => c.type === 2).length;

        await interaction.reply({ embeds: [{
          title: `📊 ${guild.name}`,
          color: 0x2B2D31,
          fields: [
            { name: '👑 Propriétaire', value: `<@${guild.owner_id}>`, inline: true },
            { name: '👥 Membres', value: `${guild.approximate_member_count || 'N/A'}`, inline: true },
            { name: '💬 Textuels', value: `${textCh}`, inline: true },
            { name: '🔊 Vocaux', value: `${voiceCh}`, inline: true },
            { name: '🚀 Boosts', value: `${guild.premium_subscription_count || 0}`, inline: true },
          ]
        }] });
        break;
      }

      case 'userinfo': {
        const targetId = interaction.options.getUser('membre')?.id || userId;
        const [userRes, memberRes] = await Promise.all([discordFetch(`/users/${targetId}`), discordFetch(`/guilds/${guildId}/members/${targetId}`)]);
        const targetUser = await userRes.json() as any;
        const member = await memberRes.json() as any;
        const joinedAt = member.joined_at ? new Date(member.joined_at).toLocaleDateString('fr-FR') : 'N/A';

        await interaction.reply({ embeds: [{
          title: `👤 ${targetUser.username}`,
          color: 0x2B2D31,
          thumbnail: targetUser.avatar ? { url: `https://cdn.discordapp.com/avatars/${targetId}/${targetUser.avatar}.png` } : undefined,
          fields: [
            { name: '🆔 ID', value: `\`${targetId}\``, inline: true },
            { name: '📥 Rejoint le', value: joinedAt, inline: true },
            { name: '🎭 Rôles', value: member.roles?.slice(0, 10).map((r: string) => `<@&${r}>`).join(' ') || 'Aucun', inline: false },
          ]
        }] });
        break;
      }

      case 'embed': {
        const title = interaction.options.getString('titre', true);
        const description = interaction.options.getString('description', true);
        const colorStr = interaction.options.getString('couleur');
        let color = 0x2B2D31;
        if (colorStr) color = parseInt(colorStr.replace('#', ''), 16) || 0x2B2D31;
        await interaction.reply({ embeds: [{ title, description, color, timestamp: new Date().toISOString() }] });
        break;
      }

      case 'slowmode': {
        const duration = interaction.options.getInteger('duree', true);
        const channelId = interaction.options.getChannel('salon')?.id || interaction.channelId;
        await discordFetch(`/channels/${channelId}`, { method: 'PATCH', body: JSON.stringify({ rate_limit_per_user: duration }) });
        await interaction.reply(duration === 0 ? `⏱️ Slowmode désactivé.` : `⏱️ Slowmode: **${duration}s** dans <#${channelId}>.`);
        break;
      }

      case 'announce': {
        const title = interaction.options.getString('titre', true);
        const message = interaction.options.getString('message', true);
        const channelId = interaction.options.getChannel('salon')?.id || interaction.channelId;
        const mention = interaction.options.getBoolean('mention') || false;
        await discordFetch(`/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: mention ? '@everyone' : '', embeds: [{ title: `📢 ${title}`, description: message, color: 0x3B82F6, timestamp: new Date().toISOString(), footer: { text: `Par ${user.username}` } }] })
        });
        await interaction.reply({ content: `✅ Annonce envoyée dans <#${channelId}>.`, ephemeral: true });
        break;
      }

      case 'temprole': {
        const memberId = interaction.options.getUser('membre', true).id;
        const roleId = interaction.options.getRole('role', true).id;
        const durationStr = interaction.options.getString('duree', true);
        const durationMs = parseDuration(durationStr);
        if (!durationMs) { await interaction.reply({ content: '❌ Durée invalide.', ephemeral: true }); break; }
        await discordFetch(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, { method: 'PUT' });
        await supabase.from('temp_roles').insert({ guild_id: guildId, user_id: memberId, role_id: roleId, expires_at: new Date(Date.now() + durationMs).toISOString() });
        await interaction.reply(`✅ Rôle <@&${roleId}> ajouté à <@${memberId}> pour **${formatDuration(durationMs)}**.`);
        break;
      }

      // ===== TICKETS =====
      case 'ticket': {
        const subject = interaction.options.getString('sujet') || 'Support';
        const { data: guildConfig } = await supabase.from('guild_config').select('ticket_category_id, ticket_support_role_id').eq('guild_id', guildId).single();
        const channelName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const perms: any[] = [{ id: guildId, type: 0, deny: '1024' }, { id: userId, type: 1, allow: '1024' }];
        if (guildConfig?.ticket_support_role_id) perms.push({ id: guildConfig.ticket_support_role_id, type: 0, allow: '1024' });

        const createRes = await discordFetch(`/guilds/${guildId}/channels`, { method: 'POST', body: JSON.stringify({ name: channelName, type: 0, parent_id: guildConfig?.ticket_category_id || null, permission_overwrites: perms }) });
        if (!createRes.ok) { await interaction.reply({ content: '❌ Impossible de créer le ticket.', ephemeral: true }); break; }
        const channel = await createRes.json() as any;
        await supabase.from('tickets').insert({ guild_id: guildId, channel_id: channel.id, user_id: userId, created_by: userId, subject, status: 'open' });
        await discordFetch(`/channels/${channel.id}/messages`, { method: 'POST', body: JSON.stringify({ content: `<@${userId}>`, embeds: [{ title: '🎫 Ticket Ouvert', description: `**Sujet:** ${subject}\n\nUtilisez \`/close\` pour fermer.`, color: 0x22C55E }] }) });
        await interaction.reply({ content: `✅ Ticket créé: <#${channel.id}>`, ephemeral: true });
        break;
      }

      case 'close': {
        const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channelId).single();
        if (!ticket) { await interaction.reply({ content: '❌ Pas un ticket.', ephemeral: true }); break; }
        await supabase.from('tickets').update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: userId }).eq('channel_id', interaction.channelId);
        await interaction.reply({ embeds: [{ title: '🎫 Ticket Fermé', description: `Fermé par <@${userId}>. Suppression dans 5s.`, color: 0xEF4444 }] });
        setTimeout(() => discordFetch(`/channels/${interaction.channelId}`, { method: 'DELETE' }), 5000);
        break;
      }

      case 'add': {
        const memberId = interaction.options.getUser('membre', true).id;
        const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channelId).single();
        if (!ticket) { await interaction.reply({ content: '❌ Pas un ticket.', ephemeral: true }); break; }
        await discordFetch(`/channels/${interaction.channelId}/permissions/${memberId}`, { method: 'PUT', body: JSON.stringify({ type: 1, allow: '1024' }) });
        await interaction.reply(`✅ <@${memberId}> ajouté au ticket.`);
        break;
      }

      case 'remove': {
        const memberId = interaction.options.getUser('membre', true).id;
        const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channelId).single();
        if (!ticket) { await interaction.reply({ content: '❌ Pas un ticket.', ephemeral: true }); break; }
        await discordFetch(`/channels/${interaction.channelId}/permissions/${memberId}`, { method: 'DELETE' });
        await interaction.reply(`✅ <@${memberId}> retiré du ticket.`);
        break;
      }

      case 'ticketconfig': {
        const categoryId = interaction.options.getString('categorie', true);
        const roleId = interaction.options.getRole('role_support')?.id;
        await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, ticket_category_id: categoryId, ticket_support_role_id: roleId || null, updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Tickets configurés.`);
        break;
      }

      case 'ticketpanel': {
        const channelId = interaction.options.getChannel('salon')?.id || interaction.channelId;
        await discordFetch(`/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            embeds: [{ title: '🎫 Système de Tickets', description: 'Cliquez ci-dessous pour ouvrir un ticket.', color: 0x3B82F6 }],
            components: [{ type: 1, components: [{ type: 2, style: 1, label: '📩 Ouvrir un ticket', custom_id: 'open_ticket' }] }]
          })
        });
        await interaction.reply({ content: `✅ Panel envoyé.`, ephemeral: true });
        break;
      }

      // ===== NOTES =====
      case 'note': {
        const targetId = interaction.options.getUser('membre', true).id;
        const note = interaction.options.getString('note', true);
        await supabase.from('user_notes').insert({ guild_id: guildId, user_id: targetId, moderator_id: userId, note });
        await interaction.reply({ content: `📝 Note ajoutée pour <@${targetId}>.`, ephemeral: true });
        break;
      }

      case 'notes': {
        const targetId = interaction.options.getUser('membre', true).id;
        const { data: notes } = await supabase.from('user_notes').select('*').eq('guild_id', guildId).eq('user_id', targetId).order('created_at', { ascending: false }).limit(10);
        if (!notes || notes.length === 0) { await interaction.reply({ content: `📝 Aucune note pour <@${targetId}>.`, ephemeral: true }); break; }
        const list = notes.map((n: any, i: number) => `**${i + 1}.** ${new Date(n.created_at).toLocaleDateString('fr-FR')} par <@${n.moderator_id}>\n   └ ${n.note}`).join('\n\n');
        await interaction.reply({ embeds: [{ title: '📝 Notes', description: list, color: 0x2B2D31 }], ephemeral: true });
        break;
      }

      // ===== LOGS =====
      case 'logs': {
        const gId = guildId!;
        const logChannels = [
          { order: 1, name: 'raid-logs', key: 'raid_logs_channel_id' },
          { order: 2, name: 'mod-logs', key: 'mod_logs_channel_id' },
          { order: 3, name: 'msg-logs', key: 'msg_logs_channel_id' },
          { order: 4, name: 'role-logs', key: 'role_logs_channel_id' },
          { order: 5, name: 'voice-logs', key: 'voice_logs_channel_id' },
          { order: 6, name: 'boost-logs', key: 'boost_logs_channel_id' },
        ] as const;

        await interaction.deferReply({ ephemeral: true });

        // Create category
        const catRes = await discordFetch(`/guilds/${gId}/channels`, {
          method: 'POST',
          body: JSON.stringify({ name: '📋 LOGS', type: 4, permission_overwrites: [{ id: gId, type: 0, deny: '1024' }] })
        });
        const category = await catRes.json() as any;

        const updateData: any = { id: gId, guild_id: gId, logs_category_id: category.id, updated_at: new Date().toISOString() };

        for (const lc of logChannels) {
          const chRes = await discordFetch(`/guilds/${gId}/channels`, {
            method: 'POST',
            body: JSON.stringify({ name: lc.name, type: 0, parent_id: category.id, position: lc.order })
          });
          const ch = await chRes.json() as any;
          updateData[lc.key] = ch.id;
        }

        await supabase.from('guild_config').upsert(updateData, { onConflict: 'guild_id' });
        await interaction.editReply('✅ Catégorie de logs créée avec tous les salons.');
        break;
      }

      case 'setwelcome': {
        const message = interaction.options.getString('message', true);
        const channelId = interaction.options.getChannel('salon')?.id;
        const updates: any = { id: guildId, guild_id: guildId, welcome_message: message, updated_at: new Date().toISOString() };
        if (channelId) updates.welcome_channel_id = channelId;
        await supabase.from('guild_config').upsert(updates, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Message de bienvenue configuré.`);
        break;
      }

      // ===== PROTECTION =====
      case 'antiraid': {
        const state = interaction.options.getString('etat', true);
        await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, antiraid_enabled: state === 'on', updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Antiraid ${state === 'on' ? 'activé' : 'désactivé'}.`);
        break;
      }

      case 'antilink': {
        const state = interaction.options.getString('etat', true);
        await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, antilink_enabled: state === 'on', updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Antilink ${state === 'on' ? 'activé' : 'désactivé'}.`);
        break;
      }

      case 'antispam': {
        const state = interaction.options.getString('etat', true);
        await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, antispam_enabled: state === 'on', updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Antispam ${state === 'on' ? 'activé' : 'désactivé'}.`);
        break;
      }

      case 'captcha': {
        const state = interaction.options.getString('etat', true);
        await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, captcha_enabled: state === 'on', updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Captcha ${state === 'on' ? 'activé' : 'désactivé'}.`);
        break;
      }

      case 'settings': {
        const { data: cfg } = await supabase.from('guild_config').select('*').eq('guild_id', guildId).single();
        if (!cfg) { await interaction.reply({ content: '⚙️ Aucune configuration.', ephemeral: true }); break; }
        await interaction.reply({ embeds: [{
          title: '⚙️ Configuration du serveur',
          color: 0x2B2D31,
          fields: [
            { name: '🔗 Antilink', value: cfg.antilink_enabled ? '✅' : '❌', inline: true },
            { name: '💬 Antispam', value: cfg.antispam_enabled ? '✅' : '❌', inline: true },
            { name: '🛡️ Antiraid', value: cfg.antiraid_enabled ? '✅' : '❌', inline: true },
            { name: '🔐 Captcha', value: cfg.captcha_enabled ? '✅' : '❌', inline: true },
            { name: '📷 Showpic', value: cfg.showpic_enabled ? '✅' : '❌', inline: true },
          ]
        }], ephemeral: true });
        break;
      }

      // ===== UTILITY =====
      case 'avatar': {
        const targetId = interaction.options.getUser('membre')?.id || userId;
        const userRes = await discordFetch(`/users/${targetId}`);
        const u = await userRes.json() as any;
        if (!u.avatar) { await interaction.reply({ content: '❌ Pas d\'avatar.', ephemeral: true }); break; }
        await interaction.reply({ embeds: [{ title: `🖼️ Avatar de ${u.username}`, image: { url: `https://cdn.discordapp.com/avatars/${targetId}/${u.avatar}.png?size=1024` }, color: 0x2B2D31 }] });
        break;
      }

      case 'banner': {
        const targetId = interaction.options.getUser('membre')?.id || userId;
        const userRes = await discordFetch(`/users/${targetId}`);
        const u = await userRes.json() as any;
        if (!u.banner) { await interaction.reply({ content: '❌ Pas de bannière.', ephemeral: true }); break; }
        await interaction.reply({ embeds: [{ title: `🖼️ Bannière de ${u.username}`, image: { url: `https://cdn.discordapp.com/banners/${targetId}/${u.banner}.png?size=1024` }, color: 0x2B2D31 }] });
        break;
      }

      case 'stats': {
        const [{ count: totalVisits }, { data: lastVisit }, { count: totalSubmissions }, { count: codesSubmitted }, { count: codesApproved }, { count: codesRejected }] = await Promise.all([
          supabase.from('visits').select('*', { count: 'exact', head: true }),
          supabase.from('visits').select('visited_at').order('visited_at', { ascending: false }).limit(1).single(),
          supabase.from('submissions').select('*', { count: 'exact', head: true }),
          supabase.from('submissions').select('*', { count: 'exact', head: true }).not('code', 'is', null),
          supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        ]);

        await interaction.reply({ embeds: [{
          title: '📊 Statistiques',
          color: 0x2B2D31,
          fields: [
            { name: '🌐 Visites', value: `${totalVisits || 0}`, inline: true },
            { name: '📝 Inscriptions', value: `${totalSubmissions || 0}`, inline: true },
            { name: '📤 Codes soumis', value: `${codesSubmitted || 0}`, inline: true },
            { name: '✅ Acceptés', value: `${codesApproved || 0}`, inline: true },
            { name: '❌ Refusés', value: `${codesRejected || 0}`, inline: true },
          ]
        }] });
        break;
      }

      // ===== PAYMENT =====
      case 'payment': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const { data: cfg } = await supabase.from('payment_config').select('*').eq('id', 'main').single();
        const paypalLink = cfg?.paypal_email || null;
        const ltc = cfg?.ltc_address || 'Non configuré';
        await interaction.reply({ embeds: [{
          title: '💳 Paiement',
          color: 0x3B82F6,
          fields: [
            { name: '💰 PayPal', value: paypalLink ? `[Cliquez ici pour payer](${paypalLink})` : 'Non configuré', inline: false },
            { name: '🪙 Litecoin', value: `\`\`\`${ltc}\`\`\``, inline: false },
          ]
        }] });
        break;
      }

      case 'payment2': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const { data: cfg } = await supabase.from('payment_config').select('*').eq('id', 'secondary').single();
        const paypalLink = cfg?.paypal_email || null;
        const ltc = cfg?.ltc_address || 'Non configuré';
        await interaction.reply({ embeds: [{
          title: '💳 Paiement 2',
          color: 0x8B5CF6,
          fields: [
            { name: '💰 PayPal', value: paypalLink ? `[Cliquez ici pour payer](${paypalLink})` : 'Non configuré', inline: false },
            { name: '🪙 Litecoin', value: `\`\`\`${ltc}\`\`\``, inline: false },
          ]
        }] });
        break;
      }

      case 'setpaypal': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const lien = interaction.options.getString('lien', true);
        await supabase.from('payment_config').upsert({ id: 'main', paypal_email: lien, updated_at: new Date().toISOString() });
        await interaction.reply({ content: `✅ PayPal configuré: ${lien}`, ephemeral: true });
        break;
      }

      case 'setpaypal2': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const lien = interaction.options.getString('lien', true);
        await supabase.from('payment_config').upsert({ id: 'secondary', paypal_email: lien, updated_at: new Date().toISOString() });
        await interaction.reply({ content: `✅ PayPal 2 configuré: ${lien}`, ephemeral: true });
        break;
      }

      case 'setltc': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const address = interaction.options.getString('address', true);
        await supabase.from('payment_config').upsert({ id: 'main', ltc_address: address, updated_at: new Date().toISOString() });
        await interaction.reply({ content: `✅ LTC configuré.`, ephemeral: true });
        break;
      }

      case 'setltc2': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const address = interaction.options.getString('address', true);
        await supabase.from('payment_config').upsert({ id: 'secondary', ltc_address: address, updated_at: new Date().toISOString() });
        await interaction.reply({ content: `✅ LTC 2 configuré.`, ephemeral: true });
        break;
      }

      // ===== OWNER/BUYER =====
      case 'buyer': {
        const targetId = interaction.options.getUser('membre')?.id;
        if (!targetId) {
          const { data: buyers } = await supabase.from('bot_buyers').select('*').eq('guild_id', guildId);
          if (!buyers || buyers.length === 0) { await interaction.reply({ content: '📋 Aucun buyer.', ephemeral: true }); break; }
          const list = buyers.map((b: any, i: number) => `**${i + 1}.** <@${b.user_id}>`).join('\n');
          await interaction.reply({ embeds: [{ title: '👑 Buyers', description: list, color: 0xFFD700 }], ephemeral: true });
        } else {
          const { error } = await supabase.from('bot_buyers').insert({ guild_id: guildId, user_id: targetId, added_by: userId });
          if (error?.code === '23505') { await interaction.reply({ content: `❌ <@${targetId}> est déjà buyer.`, ephemeral: true }); break; }
          await interaction.reply(`✅ <@${targetId}> ajouté comme buyer.`);
        }
        break;
      }

      case 'unbuyer': {
        const targetId = interaction.options.getUser('membre', true).id;
        const { data } = await supabase.from('bot_buyers').delete().eq('guild_id', guildId).eq('user_id', targetId).select();
        if (!data || data.length === 0) { await interaction.reply({ content: `❌ Pas un buyer.`, ephemeral: true }); break; }
        await interaction.reply(`✅ <@${targetId}> retiré des buyers.`);
        break;
      }

      case 'setowner': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const targetId = interaction.options.getUser('membre', true).id;
        const { error } = await supabase.from('bot_owners').insert({ guild_id: guildId, user_id: targetId, added_by: userId });
        if (error?.code === '23505') { await interaction.reply({ content: `❌ Déjà owner.`, ephemeral: true }); break; }
        await interaction.reply(`✅ <@${targetId}> ajouté comme owner.`);
        break;
      }

      case 'delowner': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const targetId = interaction.options.getUser('membre', true).id;
        await supabase.from('bot_owners').delete().eq('guild_id', guildId).eq('user_id', targetId);
        await interaction.reply(`✅ <@${targetId}> retiré des owners.`);
        break;
      }

      case 'listoff': {
        const { data: owners } = await supabase.from('bot_owners').select('*').eq('guild_id', guildId);
        if (!owners || owners.length === 0) { await interaction.reply({ content: '📋 Aucun owner.', ephemeral: true }); break; }
        const list = owners.map((o: any, i: number) => `**${i + 1}.** <@${o.user_id}>`).join('\n');
        await interaction.reply({ embeds: [{ title: '👑 Owners', description: list, color: 0xFFD700 }], ephemeral: true });
        break;
      }

      // ===== CREATEUR COMMANDS =====
      case 'listallowners': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const { data: owners } = await supabase.from('bot_owners').select('*').order('created_at', { ascending: false }).limit(25);
        if (!owners || owners.length === 0) { await interaction.reply({ content: '📋 Aucun owner.', ephemeral: true }); break; }
        const list = owners.map((o: any, i: number) => `**${i + 1}.** <@${o.user_id}> - Guild: \`${o.guild_id}\``).join('\n');
        await interaction.reply({ embeds: [{ title: '👑 Tous les Owners', description: list, color: 0xFFD700 }], ephemeral: true });
        break;
      }

      case 'listallbuyers': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const { data: buyers } = await supabase.from('bot_buyers').select('*').order('created_at', { ascending: false }).limit(25);
        if (!buyers || buyers.length === 0) { await interaction.reply({ content: '📋 Aucun buyer.', ephemeral: true }); break; }
        const list = buyers.map((b: any, i: number) => `**${i + 1}.** <@${b.user_id}> - Guild: \`${b.guild_id}\``).join('\n');
        await interaction.reply({ embeds: [{ title: '🛒 Tous les Buyers', description: list, color: 0x3B82F6 }], ephemeral: true });
        break;
      }

      case 'createlicense': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const plan = interaction.options.getString('plan') || 'standard';
        const duration = interaction.options.getInteger('duree');
        const key = generateLicenseKey();
        const durationDays = plan === 'lifetime' ? null : (duration || 30);
        await supabase.from('valid_licenses').insert({ license_key: key, plan_type: plan, duration_days: durationDays });
        await interaction.reply({ embeds: [{ title: '🔑 Licence Créée', color: 0xFFD700, fields: [{ name: '🔐 Clé', value: `\`\`\`${key}\`\`\``, inline: false }, { name: '📦 Plan', value: plan, inline: true }, { name: '⏰ Durée', value: durationDays ? `${durationDays}j` : 'Lifetime', inline: true }] }], ephemeral: true });
        break;
      }

      case 'listlicenses': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const { data: licenses } = await supabase.from('bot_licenses').select('*').order('created_at', { ascending: false }).limit(25);
        if (!licenses || licenses.length === 0) { await interaction.reply({ content: '📋 Aucune licence.', ephemeral: true }); break; }
        const list = licenses.map((l: any) => `${l.is_active ? '🟢' : '🔴'} **${l.plan_type}** - \`${l.guild_id.slice(0, 10)}...\``).join('\n');
        await interaction.reply({ embeds: [{ title: '📋 Licences', description: list, color: 0x3B82F6 }], ephemeral: true });
        break;
      }

      case 'revoke': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const targetGuildId = interaction.options.getString('guild_id', true);
        await supabase.from('bot_licenses').update({ is_active: false }).eq('guild_id', targetGuildId);
        await interaction.reply({ content: `✅ Licence révoquée pour \`${targetGuildId}\`.`, ephemeral: true });
        break;
      }

      case 'license': {
        const action = interaction.options.getString('action', true);
        if (action === 'info') {
          const { valid, license } = await hasValidLicense(supabase, guildId!);
          if (valid && license) {
            await interaction.reply({ embeds: [{ title: '📋 Licence Active', color: 0x22C55E, fields: [{ name: '📦 Plan', value: license.plan_type, inline: true }, { name: '⏰ Expire', value: license.expires_at ? new Date(license.expires_at).toLocaleDateString('fr-FR') : 'Jamais', inline: true }] }], ephemeral: true });
          } else {
            await interaction.reply({ embeds: [{ title: '❌ Pas de Licence', description: 'Utilisez `/license activate key:VOTRE-CLÉ`', color: 0xEF4444 }], ephemeral: true });
          }
        } else if (action === 'activate') {
          const key = interaction.options.getString('key');
          if (!key) { await interaction.reply({ content: '❌ Fournissez une clé.', ephemeral: true }); break; }
          const { data: validLicense } = await supabase.from('valid_licenses').select('*').eq('license_key', key).eq('redeemed', false).single();
          if (!validLicense) { await interaction.reply({ content: '❌ Clé invalide ou déjà utilisée.', ephemeral: true }); break; }

          await supabase.from('valid_licenses').update({ redeemed: true, redeemed_at: new Date().toISOString(), redeemed_by: userId }).eq('id', validLicense.id);
          const expiresAt = validLicense.duration_days ? new Date(Date.now() + validLicense.duration_days * 24 * 60 * 60 * 1000) : null;
          await supabase.from('bot_licenses').upsert({ guild_id: guildId, license_key: key, plan_type: validLicense.plan_type, activated_by: userId, is_active: true, expires_at: expiresAt?.toISOString() || null });

          await interaction.reply({ embeds: [{ title: '🎉 Licence Activée !', color: 0x22C55E, fields: [{ name: '📦 Plan', value: validLicense.plan_type, inline: true }, { name: '⏰ Expire', value: expiresAt ? expiresAt.toLocaleDateString('fr-FR') : 'Jamais', inline: true }] }] });
        }
        break;
      }

      case 'buy': {
        const plan = interaction.options.getString('plan') || 'standard';
        const stripeKey = config.STRIPE_SECRET_KEY;
        if (!stripeKey) { await interaction.reply({ content: '❌ Paiement non configuré.', ephemeral: true }); break; }
        const Stripe = require('stripe');
        const stripe = new Stripe(stripeKey);
        const STRIPE_PRICES: Record<string, any> = {
          standard: { id: 'price_1Sw3dmDv7QD9qcNwvYNM7S6W', name: 'Standard', duration: '30 jours', price: '5€' },
          premium: { id: 'price_1Sw3dxDv7QD9qcNwFVEfI5Yi', name: 'Premium', duration: '90 jours', price: '12€' },
          lifetime: { id: 'price_1Sw3e8Dv7QD9qcNwL9lGVGas', name: 'Lifetime', duration: 'À vie', price: '25€' }
        };
        const selectedPlan = STRIPE_PRICES[plan];
        if (!selectedPlan) { await interaction.reply({ content: '❌ Plan invalide.', ephemeral: true }); break; }

        const session = await stripe.checkout.sessions.create({
          line_items: [{ price: selectedPlan.id, quantity: 1 }],
          mode: 'payment',
          success_url: 'https://discord.com/channels/@me?payment=success',
          cancel_url: 'https://discord.com/channels/@me?payment=cancelled',
          metadata: { discord_user_id: userId, plan_type: plan }
        });

        await interaction.reply({ embeds: [{ title: '🛒 Acheter', description: `Plan **${selectedPlan.name}** - ${selectedPlan.price}`, color: 0x635BFF, fields: [{ name: '🔗 Payer', value: `**[Cliquez ici](${session.url})**`, inline: false }] }], ephemeral: true });
        break;
      }

      case 'redeem': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const targetUserId = interaction.options.getString('user', true);
        const plan = interaction.options.getString('plan', true);
        const key = generateLicenseKey();
        const durationDays = plan === 'lifetime' ? null : (plan === 'premium' ? 90 : 30);
        await supabase.from('valid_licenses').insert({ license_key: key, plan_type: plan, duration_days: durationDays });

        try {
          const dmRes = await discordFetch('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: targetUserId }) });
          const dm = await dmRes.json() as any;
          if (dm.id) {
            await discordFetch(`/channels/${dm.id}/messages`, {
              method: 'POST',
              body: JSON.stringify({ embeds: [{ title: '🎉 Votre Licence !', color: 0x22C55E, fields: [{ name: '🔐 Clé', value: `\`\`\`${key}\`\`\``, inline: false }, { name: '📦 Plan', value: plan, inline: true }] }] })
            });
          }
        } catch {}

        await interaction.reply({ embeds: [{ title: '✅ Licence envoyée', description: `Envoyée à <@${targetUserId}>`, color: 0x22C55E, fields: [{ name: '🔐 Clé', value: `\`\`\`${key}\`\`\``, inline: false }] }] });
        break;
      }

      // ===== IP BAN =====
      case 'banip': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const ip = interaction.options.getString('ip', true);
        const reason = interaction.options.getString('raison') || 'Aucune raison';
        await supabase.from('banned_ips').insert({ ip_address: ip, reason, banned_by: userId });
        await interaction.reply({ embeds: [{ title: '🚫 IP Bannie', color: 0xEF4444, fields: [{ name: '🌐 IP', value: `\`${ip}\``, inline: true }, { name: '📝 Raison', value: reason, inline: true }] }], ephemeral: true });
        break;
      }

      case 'unbanip': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const ip = interaction.options.getString('ip', true);
        await supabase.from('banned_ips').delete().eq('ip_address', ip);
        await interaction.reply({ content: `✅ IP \`${ip}\` débannie.`, ephemeral: true });
        break;
      }

      case 'listbannedips': {
        if (!isCreateur(userId)) { await interaction.reply({ content: '❌ Créateurs seulement.', ephemeral: true }); break; }
        const { data: ips } = await supabase.from('banned_ips').select('*').order('created_at', { ascending: false }).limit(25);
        if (!ips || ips.length === 0) { await interaction.reply({ content: '📋 Aucune IP bannie.', ephemeral: true }); break; }
        const list = ips.map((ip: any, i: number) => `**${i + 1}.** \`${ip.ip_address}\` - ${ip.reason || 'Aucune'}`).join('\n');
        await interaction.reply({ embeds: [{ title: '🚫 IPs Bannies', description: list, color: 0xEF4444 }], ephemeral: true });
        break;
      }

      // ===== DMALL =====
      case 'dmall': {
        const message = interaction.options.getString('message', true);
        const guildRes = await discordFetch(`/guilds/${guildId}`);
        const guild = await guildRes.json() as any;
        if (guild.owner_id !== userId && !isCreateur(userId)) { await interaction.reply({ content: '❌ Propriétaire seulement.', ephemeral: true }); break; }

        await interaction.deferReply({ ephemeral: true });
        const membersRes = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
        const members = await membersRes.json() as any[];
        const humans = members.filter((m: any) => !m.user?.bot);
        let sent = 0, failed = 0;

        for (const m of humans) {
          try {
            const dmRes = await discordFetch('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: m.user.id }) });
            const dm = await dmRes.json() as any;
            if (dm.id) {
              const sendRes = await discordFetch(`/channels/${dm.id}/messages`, { method: 'POST', body: JSON.stringify({ content: message }) });
              if (sendRes.ok) sent++; else failed++;
            } else failed++;
            await new Promise(r => setTimeout(r, 1500));
          } catch { failed++; }
        }

        await interaction.editReply({ embeds: [{ title: '📩 DM All - Terminé', color: 0x22C55E, fields: [{ name: '✅ Envoyés', value: `${sent}`, inline: true }, { name: '❌ Échoués', value: `${failed}`, inline: true }, { name: '👥 Total', value: `${humans.length}`, inline: true }] }] });
        break;
      }

      // ===== CONFIG EXTRAS =====
      case 'counter': {
        const action = interaction.options.getString('action', true);
        const channelId = interaction.options.getChannel('salon')?.id;
        const counterType = interaction.options.getString('type') || 'members';
        if (action === 'view') {
          const { data: counters } = await supabase.from('counters').select('*').eq('guild_id', guildId);
          if (!counters?.length) { await interaction.reply({ content: '📊 Aucun compteur.', ephemeral: true }); break; }
          await interaction.reply({ embeds: [{ title: '📊 Compteurs', description: counters.map((c: any) => `<#${c.channel_id}> - ${c.counter_type}`).join('\n'), color: 0x3B82F6 }], ephemeral: true });
        } else if (action === 'create' && channelId) {
          await supabase.from('counters').insert({ guild_id: guildId, channel_id: channelId, counter_type: counterType });
          await interaction.reply(`✅ Compteur créé dans <#${channelId}>.`);
        } else if (action === 'delete' && channelId) {
          await supabase.from('counters').delete().eq('guild_id', guildId).eq('channel_id', channelId);
          await interaction.reply(`✅ Compteur supprimé.`);
        }
        break;
      }

      case 'hidereply': {
        const state = interaction.options.getString('etat', true);
        await supabase.from('guild_config').upsert({ id: guildId, guild_id: guildId, hide_no_permission_reply: state === 'on', updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Réponses ${state === 'on' ? 'masquées' : 'affichées'}.`);
        break;
      }

      case 'showpic': {
        const state = interaction.options.getString('etat', true);
        const channelId = interaction.options.getChannel('salon')?.id;
        const updates: any = { id: guildId, guild_id: guildId, showpic_enabled: state === 'on', updated_at: new Date().toISOString() };
        if (channelId) updates.showpic_channel_id = channelId;
        await supabase.from('guild_config').upsert(updates, { onConflict: 'guild_id' });
        await interaction.reply(`✅ Showpic ${state === 'on' ? 'activé' : 'désactivé'}.`);
        break;
      }

      case 'rename': {
        const newName = interaction.options.getString('nom', true);
        const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channelId).single();
        if (!ticket) { await interaction.reply({ content: '❌ Pas un ticket.', ephemeral: true }); break; }
        await discordFetch(`/channels/${interaction.channelId}`, { method: 'PATCH', body: JSON.stringify({ name: newName }) });
        await interaction.reply(`✅ Ticket renommé: **${newName}**.`);
        break;
      }

      case 'renew': {
        const channelId = interaction.options.getChannel('salon')?.id || interaction.channelId;
        const chRes = await discordFetch(`/channels/${channelId}`);
        const ch = await chRes.json() as any;
        await discordFetch(`/channels/${channelId}`, { method: 'DELETE' });
        const newCh = await discordFetch(`/guilds/${guildId}/channels`, {
          method: 'POST',
          body: JSON.stringify({ name: ch.name, type: ch.type, topic: ch.topic, position: ch.position, parent_id: ch.parent_id, permission_overwrites: ch.permission_overwrites })
        });
        const newChannel = await newCh.json() as any;
        await discordFetch(`/channels/${newChannel.id}/messages`, { method: 'POST', body: JSON.stringify({ content: `🔄 Salon recréé par <@${userId}>` }) });
        await interaction.reply({ content: '✅ Salon recréé.', ephemeral: true });
        break;
      }

      case 'roleinfo': {
        const roleId = interaction.options.getRole('role', true).id;
        const guildRes = await discordFetch(`/guilds/${guildId}`);
        const guild = await guildRes.json() as any;
        const role = guild.roles?.find((r: any) => r.id === roleId);
        if (!role) { await interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true }); break; }
        await interaction.reply({ embeds: [{ title: `🎭 @${role.name}`, color: role.color || 0x2B2D31, fields: [{ name: '🆔 ID', value: `\`${roleId}\``, inline: true }, { name: '📍 Position', value: `${role.position}`, inline: true }, { name: '🎨 Couleur', value: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'Aucune', inline: true }] }] });
        break;
      }

      case 'bringall': {
        const targetChannelId = interaction.options.getChannel('salon', true).id;
        await interaction.deferReply();
        const membersRes = await discordFetch(`/guilds/${guildId}/members?limit=1000`);
        const members = await membersRes.json() as any[];
        let moved = 0;
        for (const m of members) {
          const moveRes = await discordFetch(`/guilds/${guildId}/members/${m.user.id}`, { method: 'PATCH', body: JSON.stringify({ channel_id: targetChannelId }) });
          if (moveRes.ok) moved++;
        }
        await interaction.editReply(`✅ **${moved}** membres déplacés.`);
        break;
      }

      case 'rolemenu': {
        const title = interaction.options.getString('titre', true);
        const rolesStr = interaction.options.getString('roles', true);
        const roleIds = rolesStr.split(',').map(r => r.trim()).filter(r => r);
        const embed = { title: `🎭 ${title}`, description: 'Sélectionnez vos rôles.', color: 0x3B82F6 };
        const components = [{ type: 1, components: [{ type: 3, custom_id: 'rolemenu_select', placeholder: 'Sélectionnez un rôle', min_values: 0, max_values: roleIds.length, options: roleIds.map(id => ({ label: `Rôle ${id.slice(-4)}`, value: id, description: 'Ajouter/retirer' })) }] }];
        await discordFetch(`/channels/${interaction.channelId}/messages`, { method: 'POST', body: JSON.stringify({ embeds: [embed], components }) });
        await interaction.reply({ content: '✅ Menu de rôles créé.', ephemeral: true });
        break;
      }

      case 'soutien': {
        const action = interaction.options.getString('action', true);
        const roleId = interaction.options.getRole('role')?.id;
        if (action === 'list') {
          const { data: roles } = await supabase.from('support_roles').select('*').eq('guild_id', guildId);
          if (!roles?.length) { await interaction.reply({ content: '📋 Aucun rôle de soutien.', ephemeral: true }); break; }
          await interaction.reply({ embeds: [{ title: '💪 Rôles de Soutien', description: roles.map((r: any) => `<@&${r.role_id}>`).join('\n'), color: 0x22C55E }], ephemeral: true });
        } else if (action === 'add' && roleId) {
          await supabase.from('support_roles').insert({ guild_id: guildId, role_id: roleId });
          await interaction.reply(`✅ <@&${roleId}> ajouté.`);
        } else if (action === 'remove' && roleId) {
          await supabase.from('support_roles').delete().eq('guild_id', guildId).eq('role_id', roleId);
          await interaction.reply(`✅ <@&${roleId}> retiré.`);
        }
        break;
      }

      case 'piconly': {
        const action = interaction.options.getString('action', true);
        const channelId = interaction.options.getChannel('salon')?.id;
        if (action === 'list') {
          const { data: channels } = await supabase.from('piconly_channels').select('*').eq('guild_id', guildId);
          if (!channels?.length) { await interaction.reply({ content: '📷 Aucun salon photo.', ephemeral: true }); break; }
          await interaction.reply({ embeds: [{ title: '📷 Salons Photos', description: channels.map((c: any) => `<#${c.channel_id}>`).join('\n'), color: 0x8B5CF6 }], ephemeral: true });
        } else if (action === 'add' && channelId) {
          await supabase.from('piconly_channels').insert({ guild_id: guildId, channel_id: channelId });
          await interaction.reply(`✅ <#${channelId}> = photos uniquement.`);
        } else if (action === 'remove' && channelId) {
          await supabase.from('piconly_channels').delete().eq('guild_id', guildId).eq('channel_id', channelId);
          await interaction.reply(`✅ <#${channelId}> = normal.`);
        }
        break;
      }

      case 'change': {
        const oldId = interaction.options.getString('ancien', true);
        const newId = interaction.options.getString('nouveau', true);
        await Promise.all([
          supabase.from('bot_owners').update({ user_id: newId }).eq('guild_id', guildId).eq('user_id', oldId),
          supabase.from('bot_buyers').update({ user_id: newId }).eq('guild_id', guildId).eq('user_id', oldId),
        ]);
        await interaction.reply(`✅ Données transférées de <@${oldId}> à <@${newId}>.`);
        break;
      }

      default:
        await interaction.reply({ content: '❌ Commande inconnue.', ephemeral: true });
    }
  } catch (error) {
    console.error('Command error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply('❌ Une erreur est survenue.').catch(() => {});
    } else {
      await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => {});
    }
  }
});

// ========== READY ==========
client.once('ready', () => {
  console.log(`✅ Bot connecté: ${client.user?.tag}`);
  console.log(`📊 Serveurs: ${client.guilds.cache.size}`);
});

// ========== START ==========
async function start() {
  console.log('🚀 Démarrage du bot...');
  await client.login(config.DISCORD_BOT_TOKEN);
}

start().catch(console.error);
