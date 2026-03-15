import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  PermissionFlagsBits,
  Collection,
  GuildMember,
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

// ============================================================
// CONFIG EN MÉMOIRE (par serveur)
// ============================================================
interface SoutienConfig {
  roleId: string;
  urls: string[];
}

const guildConfigs = new Collection<string, SoutienConfig>();

// ============================================================
// CLIENT
// ============================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

// ============================================================
// READY
// ============================================================
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot Soutien connecté en tant que ${c.user.tag}`);
  console.log(`📡 ${c.guilds.cache.size} serveur(s)`);

  // Lancer la vérification périodique
  const interval = parseInt(process.env.CHECK_INTERVAL || '5') * 60 * 1000;
  setInterval(() => checkAllGuilds(), interval);
  console.log(`⏱️ Vérification toutes les ${process.env.CHECK_INTERVAL || '5'} minutes`);
});

// ============================================================
// VÉRIFICATION DES BIOS
// ============================================================
async function checkMemberBio(member: GuildMember, config: SoutienConfig): Promise<boolean> {
  try {
    // Forcer le fetch du profil complet pour avoir la bio
    const fetchedMember = await member.guild.members.fetch({ user: member.id, force: true });

    // Vérifier le statut custom et les activités
    const presence = fetchedMember.presence;
    let hasSoutienUrl = false;

    // Vérifier dans le statut personnalisé
    if (presence) {
      for (const activity of presence.activities) {
        const activityState = activity.state?.toLowerCase() || '';
        const activityName = activity.name?.toLowerCase() || '';
        const activityDetails = (activity as any).details?.toLowerCase() || '';
        const activityUrl = (activity as any).url?.toLowerCase() || '';

        for (const url of config.urls) {
          const urlLower = url.toLowerCase();
          if (
            activityState.includes(urlLower) ||
            activityName.includes(urlLower) ||
            activityDetails.includes(urlLower) ||
            activityUrl.includes(urlLower)
          ) {
            hasSoutienUrl = true;
            break;
          }
        }
        if (hasSoutienUrl) break;
      }
    }

    // Gérer le rôle
    const hasRole = fetchedMember.roles.cache.has(config.roleId);

    if (hasSoutienUrl && !hasRole) {
      await fetchedMember.roles.add(config.roleId, 'Soutien détecté dans la bio/statut');
      console.log(`✅ Rôle soutien ajouté à ${fetchedMember.user.tag}`);
      return true;
    } else if (!hasSoutienUrl && hasRole) {
      await fetchedMember.roles.remove(config.roleId, 'Soutien retiré - URL non détectée');
      console.log(`➖ Rôle soutien retiré de ${fetchedMember.user.tag}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`Erreur check bio ${member.user?.tag}:`, err);
    return false;
  }
}

async function checkGuild(guildId: string) {
  const config = guildConfigs.get(guildId);
  if (!config) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  console.log(`🔍 Vérification de ${guild.name}...`);
  let added = 0, removed = 0;

  try {
    const members = await guild.members.fetch({ withPresences: true });
    for (const [, member] of members) {
      if (member.user.bot) continue;
      const changed = await checkMemberBio(member, config);
      if (changed) {
        if (member.roles.cache.has(config.roleId)) added++;
        else removed++;
      }
    }
    console.log(`📊 ${guild.name}: +${added} / -${removed} soutiens`);
  } catch (err) {
    console.error(`Erreur vérification ${guild.name}:`, err);
  }
}

async function checkAllGuilds() {
  for (const [guildId] of guildConfigs) {
    await checkGuild(guildId);
  }
}

// ============================================================
// INTERACTIONS
// ============================================================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'soutien') return;
  if (!interaction.guild) return;

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  // Vérifier les permissions admin
  const member = interaction.member as GuildMember;
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xEF4444)
        .setDescription('❌ Tu dois être **administrateur** pour utiliser cette commande.')
      ],
      ephemeral: true,
    });
    return;
  }

  // ===== CONFIG =====
  if (sub === 'config') {
    const role = interaction.options.getRole('role', true);
    const urls: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const url = interaction.options.getString(`url${i}`);
      if (url) urls.push(url.trim());
    }

    guildConfigs.set(guildId, {
      roleId: role.id,
      urls,
    });

    const urlList = urls.map((u, i) => `\`${i + 1}.\` ${u}`).join('\n');

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x22C55E)
        .setTitle('✅ Configuration Soutien enregistrée')
        .addFields(
          { name: '🎭 Rôle', value: `<@&${role.id}>`, inline: true },
          { name: '🔢 URLs configurées', value: `${urls.length}`, inline: true },
          { name: '🔗 URLs à détecter', value: urlList },
          { name: '💡 Info', value: 'Le bot vérifie les **statuts personnalisés** et **activités** des membres. Les membres avec une de ces URLs dans leur statut recevront automatiquement le rôle.' }
        )
        .setTimestamp()
      ],
    });

    // Lancer une vérification immédiate
    checkGuild(guildId);
  }

  // ===== LIST =====
  else if (sub === 'list') {
    const config = guildConfigs.get(guildId);

    if (!config) {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xF59E0B)
          .setDescription('⚠️ Aucune configuration soutien. Utilise `/soutien config` pour configurer.')
        ],
        ephemeral: true,
      });
      return;
    }

    const urlList = config.urls.map((u, i) => `\`${i + 1}.\` ${u}`).join('\n');

    // Compter les membres avec le rôle
    const membersWithRole = interaction.guild.members.cache.filter(m => m.roles.cache.has(config.roleId));

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3B82F6)
        .setTitle('📋 Configuration Soutien')
        .addFields(
          { name: '🎭 Rôle', value: `<@&${config.roleId}>`, inline: true },
          { name: '👥 Membres soutien', value: `${membersWithRole.size}`, inline: true },
          { name: '🔗 URLs configurées', value: urlList || 'Aucune' },
        )
        .setTimestamp()
      ],
    });
  }

  // ===== CHECK =====
  else if (sub === 'check') {
    const config = guildConfigs.get(guildId);

    if (!config) {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xF59E0B)
          .setDescription('⚠️ Aucune configuration soutien. Utilise `/soutien config` pour configurer.')
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3B82F6)
        .setDescription('🔄 Vérification en cours de tous les membres...')
      ],
    });

    await checkGuild(guildId);

    const membersWithRole = interaction.guild.members.cache.filter(m => m.roles.cache.has(config.roleId));

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x22C55E)
        .setTitle('✅ Vérification terminée')
        .setDescription(`**${membersWithRole.size}** membre(s) ont actuellement le rôle soutien.`)
        .setTimestamp()
      ],
    });
  }

  // ===== RESET =====
  else if (sub === 'reset') {
    guildConfigs.delete(guildId);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('🗑️ Configuration supprimée')
        .setDescription('La configuration soutien a été supprimée. Les rôles déjà attribués restent en place.')
        .setTimestamp()
      ],
    });
  }
});

// ============================================================
// DÉTECTION EN TEMPS RÉEL (changement de statut)
// ============================================================
client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
  if (!newPresence.guild) return;
  const config = guildConfigs.get(newPresence.guild.id);
  if (!config) return;

  const member = newPresence.member;
  if (!member || member.user.bot) return;

  await checkMemberBio(member, config);
});

// ============================================================
// LOGIN
// ============================================================
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN manquant dans .env');
  process.exit(1);
}

client.login(token);
