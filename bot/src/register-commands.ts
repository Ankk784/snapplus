import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const commands = [
  // ===== MODÉRATION =====
  new SlashCommandBuilder().setName('ban').setDescription('🔨 Bannir un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre à bannir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du ban')),
  new SlashCommandBuilder().setName('unban').setDescription('🔓 Débannir un utilisateur')
    .addStringOption(o => o.setName('user_id').setDescription('ID de l\'utilisateur').setRequired(true)),
  new SlashCommandBuilder().setName('kick').setDescription('👢 Expulser un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre à expulser').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison')),
  new SlashCommandBuilder().setName('mute').setDescription('🔇 Mute un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Durée (1m, 1h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison')),
  new SlashCommandBuilder().setName('unmute').setDescription('🔊 Unmute un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('⚠️ Avertir un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison')),
  new SlashCommandBuilder().setName('clear').setDescription('🗑️ Supprimer des messages')
    .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages').setRequired(true))
    .addUserOption(o => o.setName('membre').setDescription('Filtrer par membre')),
  new SlashCommandBuilder().setName('lock').setDescription('🔒 Verrouiller un salon')
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),
  new SlashCommandBuilder().setName('unlock').setDescription('🔓 Déverrouiller un salon')
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),
  new SlashCommandBuilder().setName('addrole').setDescription('➕ Ajouter un rôle')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)),
  new SlashCommandBuilder().setName('delrole').setDescription('➖ Retirer un rôle')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)),
  new SlashCommandBuilder().setName('sanctions').setDescription('📋 Voir les sanctions')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('sanctions-clear').setDescription('🗑️ Effacer les sanctions')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('banlist').setDescription('📋 Liste des bannis'),
  new SlashCommandBuilder().setName('mutelist').setDescription('📋 Liste des mutes'),

  // ===== GESTION =====
  new SlashCommandBuilder().setName('massiverole').setDescription('📌 Donner un rôle à tous')
    .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)),
  new SlashCommandBuilder().setName('unmassiverole').setDescription('📌 Retirer un rôle à tous')
    .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)),
  new SlashCommandBuilder().setName('renew').setDescription('🔄 Recréer un salon')
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),
  new SlashCommandBuilder().setName('embed').setDescription('📝 Envoyer un embed')
    .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
    .addStringOption(o => o.setName('couleur').setDescription('Couleur hex (#FF0000)')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('📊 Infos du serveur'),
  new SlashCommandBuilder().setName('userinfo').setDescription('👤 Infos d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),
  new SlashCommandBuilder().setName('roleinfo').setDescription('🎭 Infos d\'un rôle')
    .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)),
  new SlashCommandBuilder().setName('bringall').setDescription('🔊 Déplacer tout le monde')
    .addChannelOption(o => o.setName('salon').setDescription('Salon vocal').setRequired(true)),
  new SlashCommandBuilder().setName('slowmode').setDescription('⏱️ Mode lent')
    .addIntegerOption(o => o.setName('duree').setDescription('Durée en secondes').setRequired(true))
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),
  new SlashCommandBuilder().setName('temprole').setDescription('⏰ Rôle temporaire')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Durée (1h, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('announce').setDescription('📢 Annonce')
    .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true))
    .addChannelOption(o => o.setName('salon').setDescription('Salon'))
    .addBooleanOption(o => o.setName('mention').setDescription('@everyone')),
  new SlashCommandBuilder().setName('rolemenu').setDescription('🎭 Menu de rôles')
    .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true))
    .addStringOption(o => o.setName('roles').setDescription('IDs séparés par virgule').setRequired(true))
    .addStringOption(o => o.setName('message_id').setDescription('ID message à modifier')),

  // ===== TICKETS =====
  new SlashCommandBuilder().setName('ticket').setDescription('🎫 Ouvrir un ticket')
    .addStringOption(o => o.setName('sujet').setDescription('Sujet')),
  new SlashCommandBuilder().setName('close').setDescription('🎫 Fermer un ticket')
    .addStringOption(o => o.setName('raison').setDescription('Raison')),
  new SlashCommandBuilder().setName('add').setDescription('➕ Ajouter au ticket')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('remove').setDescription('➖ Retirer du ticket')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('ticketconfig').setDescription('⚙️ Configurer les tickets')
    .addStringOption(o => o.setName('categorie').setDescription('ID de la catégorie').setRequired(true))
    .addRoleOption(o => o.setName('role_support').setDescription('Rôle support')),
  new SlashCommandBuilder().setName('ticketpanel').setDescription('🎫 Panel de tickets')
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),
  new SlashCommandBuilder().setName('rename').setDescription('✏️ Renommer le ticket')
    .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true)),

  // ===== NOTES =====
  new SlashCommandBuilder().setName('note').setDescription('📝 Ajouter une note')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note').setRequired(true)),
  new SlashCommandBuilder().setName('notes').setDescription('📝 Voir les notes')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('logs').setDescription('📋 Créer les salons de logs'),
  new SlashCommandBuilder().setName('setwelcome').setDescription('👋 Message de bienvenue')
    .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true))
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),

  // ===== PROTECTION =====
  new SlashCommandBuilder().setName('antiraid').setDescription('🛡️ Antiraid')
    .addStringOption(o => o.setName('etat').setDescription('on/off').setRequired(true).addChoices({ name: 'Activer', value: 'on' }, { name: 'Désactiver', value: 'off' })),
  new SlashCommandBuilder().setName('antilink').setDescription('🔗 Antilink')
    .addStringOption(o => o.setName('etat').setDescription('on/off').setRequired(true).addChoices({ name: 'Activer', value: 'on' }, { name: 'Désactiver', value: 'off' })),
  new SlashCommandBuilder().setName('antispam').setDescription('💬 Antispam')
    .addStringOption(o => o.setName('etat').setDescription('on/off').setRequired(true).addChoices({ name: 'Activer', value: 'on' }, { name: 'Désactiver', value: 'off' })),
  new SlashCommandBuilder().setName('captcha').setDescription('🔐 Captcha')
    .addStringOption(o => o.setName('etat').setDescription('on/off').setRequired(true).addChoices({ name: 'Activer', value: 'on' }, { name: 'Désactiver', value: 'off' })),
  new SlashCommandBuilder().setName('settings').setDescription('⚙️ Voir la configuration'),

  // ===== UTILITAIRES =====
  new SlashCommandBuilder().setName('help').setDescription('📚 Afficher l\'aide'),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Latence du bot'),
  new SlashCommandBuilder().setName('say').setDescription('💬 Faire parler le bot')
    .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)),
  new SlashCommandBuilder().setName('avatar').setDescription('🖼️ Avatar')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),
  new SlashCommandBuilder().setName('banner').setDescription('🖼️ Bannière')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),
  new SlashCommandBuilder().setName('stats').setDescription('📊 Statistiques'),
  new SlashCommandBuilder().setName('dmall').setDescription('📩 DM tous les membres')
    .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)),

  // ===== OWNER/BUYER =====
  new SlashCommandBuilder().setName('buyer').setDescription('👑 Ajouter un buyer')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),
  new SlashCommandBuilder().setName('unbuyer').setDescription('👑 Retirer un buyer')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('setowner').setDescription('👑 Ajouter un owner')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('delowner').setDescription('👑 Retirer un owner')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('listoff').setDescription('👑 Liste des owners'),
  new SlashCommandBuilder().setName('change').setDescription('🔄 Transférer les données')
    .addStringOption(o => o.setName('ancien').setDescription('Ancien ID').setRequired(true))
    .addStringOption(o => o.setName('nouveau').setDescription('Nouveau ID').setRequired(true)),

  // ===== CONFIG =====
  new SlashCommandBuilder().setName('counter').setDescription('📊 Compteur')
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Voir', value: 'view' }, { name: 'Créer', value: 'create' }, { name: 'Supprimer', value: 'delete' }))
    .addChannelOption(o => o.setName('salon').setDescription('Salon'))
    .addStringOption(o => o.setName('type').setDescription('Type de compteur')),
  new SlashCommandBuilder().setName('hidereply').setDescription('🙈 Masquer les réponses')
    .addStringOption(o => o.setName('etat').setDescription('on/off').setRequired(true).addChoices({ name: 'Activer', value: 'on' }, { name: 'Désactiver', value: 'off' })),
  new SlashCommandBuilder().setName('showpic').setDescription('📷 Showpic')
    .addStringOption(o => o.setName('etat').setDescription('on/off').setRequired(true).addChoices({ name: 'Activer', value: 'on' }, { name: 'Désactiver', value: 'off' }))
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),
  new SlashCommandBuilder().setName('soutien').setDescription('💪 Rôles de soutien')
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Liste', value: 'list' }, { name: 'Ajouter', value: 'add' }, { name: 'Retirer', value: 'remove' }))
    .addRoleOption(o => o.setName('role').setDescription('Rôle')),
  new SlashCommandBuilder().setName('piconly').setDescription('📷 Salon photos uniquement')
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Liste', value: 'list' }, { name: 'Ajouter', value: 'add' }, { name: 'Retirer', value: 'remove' }))
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),

  // ===== LICENCE & PAIEMENT =====
  new SlashCommandBuilder().setName('license').setDescription('🔑 Gestion de licence')
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Info', value: 'info' }, { name: 'Activer', value: 'activate' }))
    .addStringOption(o => o.setName('key').setDescription('Clé de licence')),
  new SlashCommandBuilder().setName('buy').setDescription('🛒 Acheter une licence')
    .addStringOption(o => o.setName('plan').setDescription('Plan').addChoices({ name: 'Standard (5€)', value: 'standard' }, { name: 'Premium (12€)', value: 'premium' }, { name: 'Lifetime (25€)', value: 'lifetime' })),
  new SlashCommandBuilder().setName('redeem').setDescription('🎁 Envoyer une licence')
    .addStringOption(o => o.setName('user').setDescription('ID utilisateur').setRequired(true))
    .addStringOption(o => o.setName('plan').setDescription('Plan').setRequired(true).addChoices({ name: 'Standard', value: 'standard' }, { name: 'Premium', value: 'premium' }, { name: 'Lifetime', value: 'lifetime' })),
  new SlashCommandBuilder().setName('payment').setDescription('💳 Infos paiement'),
  new SlashCommandBuilder().setName('payment2').setDescription('💳 Infos paiement 2'),
  new SlashCommandBuilder().setName('setpaypal').setDescription('💰 Configurer PayPal')
    .addStringOption(o => o.setName('lien').setDescription('Lien PayPal').setRequired(true))
    .addStringOption(o => o.setName('price_standard').setDescription('Prix standard'))
    .addStringOption(o => o.setName('price_premium').setDescription('Prix premium'))
    .addStringOption(o => o.setName('price_lifetime').setDescription('Prix lifetime')),
  new SlashCommandBuilder().setName('setpaypal2').setDescription('💰 Configurer PayPal 2')
    .addStringOption(o => o.setName('lien').setDescription('Lien PayPal').setRequired(true))
    .addStringOption(o => o.setName('price_standard').setDescription('Prix standard'))
    .addStringOption(o => o.setName('price_premium').setDescription('Prix premium'))
    .addStringOption(o => o.setName('price_lifetime').setDescription('Prix lifetime')),
  new SlashCommandBuilder().setName('setltc').setDescription('🪙 Configurer Litecoin')
    .addStringOption(o => o.setName('address').setDescription('Adresse LTC').setRequired(true)),
  new SlashCommandBuilder().setName('setltc2').setDescription('🪙 Configurer Litecoin 2')
    .addStringOption(o => o.setName('address').setDescription('Adresse LTC').setRequired(true)),

  // ===== CRÉATEUR =====
  new SlashCommandBuilder().setName('listallowners').setDescription('👑 Tous les owners'),
  new SlashCommandBuilder().setName('listallbuyers').setDescription('🛒 Tous les buyers'),
  new SlashCommandBuilder().setName('listlicenses').setDescription('📋 Toutes les licences'),
  new SlashCommandBuilder().setName('revoke').setDescription('🚫 Révoquer une licence')
    .addStringOption(o => o.setName('guild_id').setDescription('ID du serveur').setRequired(true)),
  new SlashCommandBuilder().setName('createlicense').setDescription('🔑 Créer une licence')
    .addStringOption(o => o.setName('plan').setDescription('Plan').addChoices({ name: 'Standard', value: 'standard' }, { name: 'Premium', value: 'premium' }, { name: 'Lifetime', value: 'lifetime' }))
    .addIntegerOption(o => o.setName('duree').setDescription('Durée en jours')),
  new SlashCommandBuilder().setName('banip').setDescription('🚫 Bannir une IP')
    .addStringOption(o => o.setName('ip').setDescription('Adresse IP').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison')),
  new SlashCommandBuilder().setName('unbanip').setDescription('✅ Débannir une IP')
    .addStringOption(o => o.setName('ip').setDescription('Adresse IP').setRequired(true)),
  new SlashCommandBuilder().setName('listbannedips').setDescription('📋 IPs bannies'),
].map(cmd => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  console.log(`🔄 Enregistrement de ${commands.length} commandes...`);
  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID!),
    { body: commands }
  );
  console.log(`✅ ${commands.length} commandes enregistrées !`);
})();
