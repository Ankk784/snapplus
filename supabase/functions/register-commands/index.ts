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
        name: 'help',
        description: 'Affiche la liste des commandes disponibles'
      },
      {
        name: 'say',
        description: 'Envoie un message dans le salon',
        options: [
          { name: 'message', description: 'Le message à envoyer', type: 3, required: true }
        ]
      },
      {
        name: 'stats',
        description: 'Affiche les statistiques en temps réel'
      },
      // --- MODERATION COMMANDS ---
      {
        name: 'ban',
        description: 'Bannir un utilisateur du serveur',
        default_member_permissions: '4',
        options: [
          { name: 'membre', description: 'L\'utilisateur à bannir', type: 6, required: true },
          { name: 'raison', description: 'Raison du ban', type: 3, required: false }
        ]
      },
      {
        name: 'unban',
        description: 'Débannir un utilisateur',
        default_member_permissions: '4',
        options: [
          { name: 'user_id', description: 'ID de l\'utilisateur à débannir', type: 3, required: true }
        ]
      },
      {
        name: 'kick',
        description: 'Expulser un utilisateur du serveur',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur à expulser', type: 6, required: true },
          { name: 'raison', description: 'Raison de l\'expulsion', type: 3, required: false }
        ]
      },
      {
        name: 'mute',
        description: 'Rendre muet un utilisateur (timeout)',
        default_member_permissions: '1099511627776',
        options: [
          { name: 'membre', description: 'L\'utilisateur à mute', type: 6, required: true },
          { name: 'duree', description: 'Durée (ex: 10m, 1h, 1d)', type: 3, required: true },
          { name: 'raison', description: 'Raison du mute', type: 3, required: false }
        ]
      },
      {
        name: 'unmute',
        description: 'Retirer le mute d\'un utilisateur',
        default_member_permissions: '1099511627776',
        options: [
          { name: 'membre', description: 'L\'utilisateur à unmute', type: 6, required: true }
        ]
      },
      {
        name: 'clear',
        description: 'Supprimer des messages dans le salon',
        default_member_permissions: '8192',
        options: [
          { name: 'nombre', description: 'Nombre de messages à supprimer (1-100)', type: 4, required: true },
          { name: 'membre', description: 'Filtrer par utilisateur', type: 6, required: false }
        ]
      },
      {
        name: 'lock',
        description: 'Verrouiller un salon',
        default_member_permissions: '16',
        options: [
          { name: 'salon', description: 'Salon à verrouiller (défaut: actuel)', type: 7, required: false }
        ]
      },
      {
        name: 'unlock',
        description: 'Déverrouiller un salon',
        default_member_permissions: '16',
        options: [
          { name: 'salon', description: 'Salon à déverrouiller (défaut: actuel)', type: 7, required: false }
        ]
      },
      {
        name: 'addrole',
        description: 'Ajouter un rôle à un membre',
        default_member_permissions: '268435456',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true },
          { name: 'role', description: 'Le rôle à ajouter', type: 8, required: true }
        ]
      },
      {
        name: 'delrole',
        description: 'Retirer un rôle d\'un membre',
        default_member_permissions: '268435456',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true },
          { name: 'role', description: 'Le rôle à retirer', type: 8, required: true }
        ]
      },
      {
        name: 'sanctions',
        description: 'Voir les sanctions d\'un utilisateur',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true }
        ]
      },
      {
        name: 'banlist',
        description: 'Voir la liste des utilisateurs bannis',
        default_member_permissions: '4'
      },
      {
        name: 'mutelist',
        description: 'Voir la liste des utilisateurs en timeout',
        default_member_permissions: '1099511627776'
      },
      {
        name: 'warn',
        description: 'Avertir un utilisateur',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur à avertir', type: 6, required: true },
          { name: 'raison', description: 'Raison de l\'avertissement', type: 3, required: true }
        ]
      },
      {
        name: 'sanctions-clear',
        description: 'Supprimer les sanctions d\'un membre',
        default_member_permissions: '8',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true }
        ]
      },
      // --- SERVER GESTION COMMANDS ---
      {
        name: 'massiverole',
        description: 'Ajouter un rôle à tous les membres du serveur',
        default_member_permissions: '8',
        options: [
          { name: 'role', description: 'Le rôle à ajouter', type: 8, required: true }
        ]
      },
      {
        name: 'unmassiverole',
        description: 'Retirer un rôle de tous les membres du serveur',
        default_member_permissions: '8',
        options: [
          { name: 'role', description: 'Le rôle à retirer', type: 8, required: true }
        ]
      },
      {
        name: 'renew',
        description: 'Recréer un salon (le supprimer et le recréer identique)',
        default_member_permissions: '16',
        options: [
          { name: 'salon', description: 'Salon à recréer (défaut: actuel)', type: 7, required: false }
        ]
      },
      {
        name: 'embed',
        description: 'Créer un embed personnalisé',
        default_member_permissions: '8192',
        options: [
          { name: 'titre', description: 'Titre de l\'embed', type: 3, required: true },
          { name: 'description', description: 'Description de l\'embed', type: 3, required: true },
          { name: 'couleur', description: 'Couleur hex (ex: #FF0000)', type: 3, required: false }
        ]
      },
      {
        name: 'serverinfo',
        description: 'Affiche les informations du serveur',
        default_member_permissions: null
      },
      {
        name: 'userinfo',
        description: 'Affiche les informations d\'un utilisateur',
        default_member_permissions: null,
        options: [
          { name: 'membre', description: 'L\'utilisateur (défaut: vous)', type: 6, required: false }
        ]
      },
      {
        name: 'roleinfo',
        description: 'Affiche les informations d\'un rôle',
        default_member_permissions: null,
        options: [
          { name: 'role', description: 'Le rôle', type: 8, required: true }
        ]
      },
      {
        name: 'bringall',
        description: 'Déplacer tous les utilisateurs d\'un salon vocal vers un autre',
        default_member_permissions: '16777216',
        options: [
          { name: 'salon', description: 'Salon vocal de destination', type: 7, required: true }
        ]
      },
      // --- NEW COMMANDS ---
      {
        name: 'slowmode',
        description: 'Définir le slowmode d\'un salon',
        default_member_permissions: '16',
        options: [
          { name: 'duree', description: 'Durée en secondes (0 pour désactiver)', type: 4, required: true },
          { name: 'salon', description: 'Salon (défaut: actuel)', type: 7, required: false }
        ]
      },
      {
        name: 'temprole',
        description: 'Ajouter un rôle temporaire à un membre',
        default_member_permissions: '268435456',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true },
          { name: 'role', description: 'Le rôle à ajouter', type: 8, required: true },
          { name: 'duree', description: 'Durée (ex: 1h, 1d, 7d)', type: 3, required: true }
        ]
      },
      {
        name: 'note',
        description: 'Ajouter une note privée sur un utilisateur',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true },
          { name: 'note', description: 'La note à ajouter', type: 3, required: true }
        ]
      },
      {
        name: 'notes',
        description: 'Voir les notes sur un utilisateur',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur', type: 6, required: true }
        ]
      },
      {
        name: 'announce',
        description: 'Envoyer une annonce formatée',
        default_member_permissions: '8192',
        options: [
          { name: 'titre', description: 'Titre de l\'annonce', type: 3, required: true },
          { name: 'message', description: 'Contenu de l\'annonce', type: 3, required: true },
          { name: 'salon', description: 'Salon de destination', type: 7, required: false },
          { name: 'mention', description: 'Mentionner @everyone', type: 5, required: false }
        ]
      },
      // --- TICKET SYSTEM ---
      {
        name: 'ticket',
        description: 'Créer un ticket de support',
        options: [
          { name: 'sujet', description: 'Sujet du ticket', type: 3, required: false }
        ]
      },
      {
        name: 'close',
        description: 'Fermer un ticket',
        default_member_permissions: '2',
        options: [
          { name: 'raison', description: 'Raison de la fermeture', type: 3, required: false }
        ]
      },
      {
        name: 'add',
        description: 'Ajouter un utilisateur au ticket',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur à ajouter', type: 6, required: true }
        ]
      },
      {
        name: 'remove',
        description: 'Retirer un utilisateur du ticket',
        default_member_permissions: '2',
        options: [
          { name: 'membre', description: 'L\'utilisateur à retirer', type: 6, required: true }
        ]
      },
      // --- CONFIGURATION ---
      {
        name: 'logs',
        description: '📋 Créer automatiquement la catégorie et les salons de logs',
        default_member_permissions: '8',
        options: []
      },
      {
        name: 'setwelcome',
        description: 'Configurer le message de bienvenue',
        default_member_permissions: '8',
        options: [
          { name: 'salon', description: 'Salon de bienvenue', type: 7, required: true },
          { name: 'message', description: 'Message ({user} = mention, {server} = nom serveur)', type: 3, required: false }
        ]
      },
      {
        name: 'antiraid',
        description: 'Activer/désactiver la protection anti-raid',
        default_member_permissions: '8',
        options: [
          { name: 'activer', description: 'Activer ou désactiver', type: 5, required: true },
          { name: 'max_joins', description: 'Nombre max de joins (défaut: 10)', type: 4, required: false },
          { name: 'secondes', description: 'Intervalle en secondes (défaut: 60)', type: 4, required: false }
        ]
      },
      {
        name: 'captcha',
        description: 'Configurer le système de captcha',
        default_member_permissions: '8',
        options: [
          { name: 'activer', description: 'Activer ou désactiver', type: 5, required: true },
          { name: 'salon', description: 'Salon de vérification', type: 7, required: false },
          { name: 'role', description: 'Rôle à donner après vérification', type: 8, required: false }
        ]
      },
      {
        name: 'antilink',
        description: 'Configurer la protection anti-liens',
        default_member_permissions: '8',
        options: [
          { 
            name: 'action', 
            description: 'Action à effectuer', 
            type: 3, 
            required: true,
            choices: [
              { name: 'on - Activer', value: 'on' },
              { name: 'off - Désactiver', value: 'off' },
              { name: 'max - Paramètres actuels', value: 'max' }
            ]
          }
        ]
      },
      {
        name: 'antilink-ignore',
        description: 'Ignorer un salon pour l\'antilink',
        default_member_permissions: '8',
        options: [
          { name: 'action', description: 'Ajouter ou retirer', type: 3, required: true, choices: [
            { name: 'on - Ignorer ce salon', value: 'on' },
            { name: 'off - Ne plus ignorer', value: 'off' }
          ]},
          { name: 'salon', description: 'Salon à ignorer', type: 7, required: true }
        ]
      },
      {
        name: 'antilink-sanction',
        description: 'Définir la sanction pour l\'antilink',
        default_member_permissions: '8',
        options: [
          { name: 'action', description: 'Activer ou désactiver les sanctions', type: 3, required: true, choices: [
            { name: 'on - Activer les sanctions', value: 'on' },
            { name: 'off - Juste supprimer', value: 'off' }
          ]}
        ]
      },
      {
        name: 'antilink-type',
        description: 'Type de liens à bloquer',
        default_member_permissions: '8',
        options: [
          { name: 'type', description: 'Type de liens', type: 3, required: true, choices: [
            { name: 'invites - Liens Discord uniquement', value: 'invites' },
            { name: 'all - Tous les liens', value: 'all' }
          ]}
        ]
      },
      {
        name: 'antispam',
        description: 'Configurer la protection anti-spam',
        default_member_permissions: '8',
        options: [
          { name: 'action', description: 'Action à effectuer', type: 3, required: true, choices: [
            { name: 'on - Activer', value: 'on' },
            { name: 'off - Désactiver', value: 'off' },
            { name: 'max - Paramètres actuels', value: 'max' }
          ]}
        ]
      },
      {
        name: 'antispam-config',
        description: 'Paramétrer l\'antispam',
        default_member_permissions: '8',
        options: [
          { name: 'messages', description: 'Nombre de messages max (défaut: 5)', type: 4, required: false },
          { name: 'secondes', description: 'Intervalle en secondes (défaut: 5)', type: 4, required: false },
          { name: 'sanction', description: 'Sanction appliquée', type: 3, required: false, choices: [
            { name: 'mute - Mute l\'utilisateur', value: 'mute' },
            { name: 'kick - Expulser', value: 'kick' },
            { name: 'ban - Bannir', value: 'ban' }
          ]}
        ]
      },
      {
        name: 'settings',
        description: 'Afficher les paramètres du bot sur le serveur',
        default_member_permissions: '8'
      },
      {
        name: 'ticketconfig',
        description: 'Configurer le système de tickets',
        default_member_permissions: '8',
        options: [
          { name: 'categorie', description: 'Catégorie pour les tickets', type: 7, required: true },
          { name: 'role_support', description: 'Rôle support qui voit les tickets', type: 8, required: false }
        ]
      },
      // --- FUN / UTILITY ---
      {
        name: 'avatar',
        description: 'Afficher l\'avatar d\'un utilisateur',
        options: [
          { name: 'membre', description: 'L\'utilisateur (défaut: vous)', type: 6, required: false }
        ]
      },
      {
        name: 'banner',
        description: 'Afficher la bannière d\'un utilisateur',
        options: [
          { name: 'membre', description: 'L\'utilisateur (défaut: vous)', type: 6, required: false }
        ]
      },
      {
        name: 'ping',
        description: 'Afficher la latence du bot'
      },
      // --- OWNER/BUYER COMMANDS ---
      {
        name: 'buyer',
        description: 'Lister les buyers ou ajouter un buyer au bot',
        default_member_permissions: '8',
        options: [
          { name: 'membre', description: 'Membre à ajouter comme buyer (optionnel)', type: 6, required: false }
        ]
      },
      {
        name: 'unbuyer',
        description: 'Supprimer un buyer du bot',
        default_member_permissions: '8',
        options: [
          { name: 'membre', description: 'Membre à retirer', type: 6, required: true }
        ]
      },
      {
        name: 'change',
        description: 'Activer ou désactiver une commande',
        default_member_permissions: '8',
        options: [
          { name: 'commande', description: 'Nom de la commande', type: 3, required: true },
          { name: 'etat', description: 'Activer ou désactiver', type: 3, required: true, choices: [
            { name: 'on - Activer', value: 'on' },
            { name: 'off - Désactiver', value: 'off' }
          ]}
        ]
      },
      {
        name: 'listoff',
        description: 'Voir la liste des commandes désactivées',
        default_member_permissions: '8'
      },
      {
        name: 'setowner',
        description: 'Ajouter un owner du bot (réservé au propriétaire du serveur)',
        default_member_permissions: '8',
        options: [
          { name: 'membre', description: 'Membre à ajouter comme owner (optionnel pour voir la liste)', type: 6, required: false }
        ]
      },
      {
        name: 'delowner',
        description: 'Retirer un owner du bot (réservé au propriétaire du serveur)',
        default_member_permissions: '8',
        options: [
          { name: 'membre', description: 'Membre à retirer', type: 6, required: true }
        ]
      },
      {
        name: 'license',
        description: 'Gérer la licence du bot',
        dm_permission: true,
        options: [
          { name: 'action', description: 'Action à effectuer', type: 3, required: true, choices: [
            { name: 'info - Voir les infos de licence', value: 'info' },
            { name: 'activate - Activer une licence', value: 'activate' },
            { name: 'generate - Générer une clé (Admin)', value: 'generate' }
          ]},
          { name: 'key', description: 'Clé de licence à activer', type: 3, required: false },
          { name: 'plan', description: 'Type de plan pour la génération', type: 3, required: false, choices: [
            { name: 'standard - Plan Standard', value: 'standard' },
            { name: 'premium - Plan Premium', value: 'premium' },
            { name: 'lifetime - Plan à vie', value: 'lifetime' }
          ]},
          { name: 'duration', description: 'Durée en jours (optionnel)', type: 4, required: false }
        ]
      },
      {
        name: 'buy',
        description: 'Acheter une licence pour le bot (paiement Stripe)',
        dm_permission: true,
        options: [
          { name: 'plan', description: 'Type de plan à acheter', type: 3, required: false, choices: [
            { name: 'standard - 30 jours (5€)', value: 'standard' },
            { name: 'premium - 90 jours (12€)', value: 'premium' },
            { name: 'lifetime - À vie (25€)', value: 'lifetime' }
          ]}
        ]
      },
      {
        name: 'redeem',
        description: 'Valider un paiement et envoyer une licence (Owner)',
        default_member_permissions: '8',
        options: [
          { name: 'user', description: 'Utilisateur qui a payé', type: 6, required: true },
          { name: 'plan', description: 'Type de plan acheté', type: 3, required: true, choices: [
            { name: 'standard - 30 jours', value: 'standard' },
            { name: 'premium - 90 jours', value: 'premium' },
            { name: 'lifetime - À vie', value: 'lifetime' }
          ]}
        ]
      },
      {
        name: 'setpaypal',
        description: 'Configurer les infos PayPal pour /buy (Créateur)',
        default_member_permissions: '8',
        options: [
          { name: 'email', description: 'Email PayPal', type: 3, required: true },
          { name: 'price_standard', description: 'Prix plan Standard (ex: 5€)', type: 3, required: false },
          { name: 'price_premium', description: 'Prix plan Premium (ex: 12€)', type: 3, required: false },
          { name: 'price_lifetime', description: 'Prix plan Lifetime (ex: 25€)', type: 3, required: false }
        ]
      },
      {
        name: 'setltc',
        description: 'Configurer l\'adresse Litecoin pour les paiements (Créateur)',
        default_member_permissions: '8',
        options: [
          { name: 'address', description: 'Adresse Litecoin', type: 3, required: true }
        ]
      },
      // --- CONFIGURATION AVANCÉE ---
      {
        name: 'counter',
        description: 'Gérer les compteurs du serveur',
        default_member_permissions: '8',
        options: [
          { name: 'action', description: 'Action à effectuer', type: 3, required: true, choices: [
            { name: 'view - Voir les compteurs', value: 'view' },
            { name: 'create - Créer un compteur', value: 'create' },
            { name: 'delete - Supprimer un compteur', value: 'delete' }
          ]},
          { name: 'salon', description: 'Salon du compteur', type: 7, required: false },
          { name: 'type', description: 'Type de compteur', type: 3, required: false, choices: [
            { name: 'members - Nombre de membres', value: 'members' },
            { name: 'bots - Nombre de bots', value: 'bots' },
            { name: 'channels - Nombre de salons', value: 'channels' },
            { name: 'roles - Nombre de rôles', value: 'roles' }
          ]}
        ]
      },
      {
        name: 'hidereply',
        description: 'Masquer les réponses du bot quand un utilisateur n\'a pas les permissions',
        default_member_permissions: '8',
        options: [
          { name: 'etat', description: 'Activer ou désactiver', type: 3, required: true, choices: [
            { name: 'on - Masquer', value: 'on' },
            { name: 'off - Afficher', value: 'off' }
          ]}
        ]
      },
      {
        name: 'rename',
        description: 'Renommer un ticket',
        default_member_permissions: '2',
        options: [
          { name: 'nom', description: 'Nouveau nom du ticket', type: 3, required: true }
        ]
      },
      {
        name: 'rolemenu',
        description: 'Créer ou modifier un menu de rôles',
        default_member_permissions: '8',
        options: [
          { name: 'titre', description: 'Titre du menu', type: 3, required: true },
          { name: 'roles', description: 'Rôles (IDs séparés par des virgules)', type: 3, required: true },
          { name: 'message_id', description: 'ID du message à modifier', type: 3, required: false }
        ]
      },
      {
        name: 'showpic',
        description: 'Configurer le snipe de photo de profil',
        default_member_permissions: '8',
        options: [
          { name: 'etat', description: 'Activer ou désactiver', type: 3, required: true, choices: [
            { name: 'on - Activer', value: 'on' },
            { name: 'off - Désactiver', value: 'off' }
          ]},
          { name: 'salon', description: 'Salon pour les notifications', type: 7, required: false }
        ]
      },
      {
        name: 'soutien',
        description: 'Gérer les rôles de soutien',
        default_member_permissions: '8',
        options: [
          { name: 'action', description: 'Action à effectuer', type: 3, required: true, choices: [
            { name: 'list - Lister les rôles', value: 'list' },
            { name: 'add - Ajouter un rôle', value: 'add' },
            { name: 'remove - Retirer un rôle', value: 'remove' }
          ]},
          { name: 'role', description: 'Rôle de soutien', type: 8, required: false }
        ]
      },
      {
        name: 'soutien-nolog',
        description: 'Ignorer les logs pour les rôles de soutien',
        default_member_permissions: '8',
        options: [
          { name: 'etat', description: 'Activer ou désactiver', type: 3, required: true, choices: [
            { name: 'on - Ignorer les logs', value: 'on' },
            { name: 'off - Ne pas ignorer', value: 'off' }
          ]}
        ]
      },
      {
        name: 'piconly',
        description: 'Gérer les salons photos uniquement',
        default_member_permissions: '8',
        options: [
          { name: 'action', description: 'Action à effectuer', type: 3, required: true, choices: [
            { name: 'add - Ajouter un salon', value: 'add' },
            { name: 'remove - Retirer un salon', value: 'remove' },
            { name: 'list - Lister les salons', value: 'list' }
          ]},
          { name: 'salon', description: 'Salon concerné', type: 7, required: false }
        ]
      },
      {
        name: 'ticketpanel',
        description: 'Afficher le panneau des tickets',
        default_member_permissions: '8',
        options: [
          { name: 'salon', description: 'Salon où afficher le panneau', type: 7, required: false }
        ]
      },
      // --- CRÉATEUR COMMANDS ---
      {
        name: 'listallowners',
        description: '🔒 [Créateur] Lister tous les owners',
        dm_permission: true,
        options: [
          { name: 'guild_id', description: 'ID du serveur (optionnel)', type: 3, required: false }
        ]
      },
      {
        name: 'listallbuyers',
        description: '🔒 [Créateur] Lister tous les buyers',
        dm_permission: true,
        options: [
          { name: 'guild_id', description: 'ID du serveur (optionnel)', type: 3, required: false }
        ]
      },
      {
        name: 'revoke',
        description: '🔒 [Créateur] Révoquer une licence',
        dm_permission: true,
        options: [
          { name: 'guild_id', description: 'ID du serveur', type: 3, required: true },
          { name: 'raison', description: 'Raison de la révocation', type: 3, required: false }
        ]
      },
      {
        name: 'createlicense',
        description: '🔒 [Créateur] Créer une licence manuellement',
        dm_permission: true,
        options: [
          { name: 'plan', description: 'Type de plan', type: 3, required: true, choices: [
            { name: 'standard - 30 jours', value: 'standard' },
            { name: 'premium - 90 jours', value: 'premium' },
            { name: 'lifetime - À vie', value: 'lifetime' }
          ]},
          { name: 'duree', description: 'Durée personnalisée en jours (optionnel)', type: 4, required: false },
          { name: 'user', description: 'Utilisateur à qui envoyer la licence', type: 6, required: false }
        ]
      },
      {
        name: 'listlicenses',
        description: '🔒 [Créateur] Lister toutes les licences',
        dm_permission: true,
        options: [
          { name: 'filtre', description: 'Filtrer les licences', type: 3, required: false, choices: [
            { name: 'active - Actives uniquement', value: 'active' },
            { name: 'expired - Expirées uniquement', value: 'expired' },
            { name: 'all - Toutes', value: 'all' }
          ]}
        ]
      },
      // --- IP BAN COMMANDS (Créateur) ---
      {
        name: 'banip',
        description: '🔒 [Créateur] Bannir une adresse IP du site',
        dm_permission: true,
        options: [
          { name: 'ip', description: 'Adresse IP à bannir', type: 3, required: true },
          { name: 'raison', description: 'Raison du ban', type: 3, required: false }
        ]
      },
      {
        name: 'unbanip',
        description: '🔒 [Créateur] Débannir une adresse IP',
        dm_permission: true,
        options: [
          { name: 'ip', description: 'Adresse IP à débannir', type: 3, required: true }
        ]
      },
      {
        name: 'listbannedips',
        description: '🔒 [Créateur] Lister les IPs bannies',
        dm_permission: true
      },
      // --- WHITE-LABEL ---
      {
        name: 'settoken',
        description: '⚙️ Configurer votre bot white-label (propriétaire uniquement)',
        default_member_permissions: '8',
        options: [
          { name: 'token', description: 'Token de votre bot Discord', type: 3, required: true },
          { name: 'app_id', description: 'Application ID de votre bot', type: 3, required: true },
          { name: 'public_key', description: 'Public Key (optionnel)', type: 3, required: false }
        ]
      },
      {
        name: 'removetoken',
        description: '⚙️ Supprimer la configuration white-label',
        default_member_permissions: '8'
      },
      // --- PAYMENT INFO (Créateur) ---
      {
        name: 'payment',
        description: '💳 Affiche les informations de paiement (PayPal & Litecoin)',
        dm_permission: true
      },
      // --- AI COMMAND ---
      {
        name: 'ia',
        description: '🤖 Pose une question à l\'IA',
        options: [
          { name: 'question', description: 'Ta question ou demande', type: 3, required: true }
        ]
      },
      // --- DMALL COMMAND ---
      {
        name: 'dmall',
        description: '📩 Envoyer un message en MP à tous les membres du serveur',
        default_member_permissions: '8',
        options: [
          { name: 'message', description: 'Le message à envoyer (supporte **gras**, *italique*, emojis, etc.)', type: 3, required: true }
        ]
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
