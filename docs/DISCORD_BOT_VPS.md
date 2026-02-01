# Guide de déploiement Discord Bot sur VPS

Ce guide explique comment déployer le bot Discord sur un VPS pour qu'il apparaisse "en ligne" 24/7 avec support white-label.

## Prérequis

- Un VPS (Railway, Render, DigitalOcean, OVH, etc.)
- Node.js 18+
- Un compte Supabase (déjà configuré)

## Structure du projet VPS

```
protect-bot/
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── moderation.ts
│   │   ├── protection.ts
│   │   ├── gestion.ts
│   │   ├── createur.ts
│   │   └── utils.ts
│   ├── events/
│   │   ├── ready.ts
│   │   ├── interactionCreate.ts
│   │   └── guildMemberAdd.ts
│   ├── utils/
│   │   ├── supabase.ts
│   │   ├── permissions.ts
│   │   └── embed.ts
│   └── config.ts
├── package.json
├── tsconfig.json
└── .env
```

## 1. Installation

```bash
mkdir protect-bot && cd protect-bot
npm init -y
npm install discord.js @supabase/supabase-js dotenv
npm install -D typescript @types/node ts-node
npx tsc --init
```

## 2. Fichier .env

```env
# Bot principal (ton bot)
DISCORD_BOT_TOKEN=ton_token_ici
DISCORD_APPLICATION_ID=ton_app_id

# Supabase
SUPABASE_URL=https://agueqvxkjmllailpoqkd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ta_service_role_key

# Créateurs (IDs Discord séparés par virgule)
CREATEURS=1419409950538727465,1285257317260066998
```

## 3. Code principal (src/index.ts)

```typescript
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Créateurs du bot
const CREATEURS = process.env.CREATEURS?.split(',') || [];

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Stockage des clients par guild (pour white-label)
const guildClients = new Map<string, Client>();

// Client principal
const mainClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans,
  ],
});

// ========== HELPERS ==========

function isCreateur(userId: string): boolean {
  return CREATEURS.includes(userId);
}

async function hasLicense(guildId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bot_licenses')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .single();
  
  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

async function isBotOwner(guildId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bot_owners')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

async function isBotBuyer(guildId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bot_buyers')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

// ========== WHITE-LABEL ==========

async function loadWhiteLabelBots() {
  const { data: configs } = await supabase
    .from('guild_bot_config')
    .select('*')
    .not('bot_token', 'is', null);

  if (!configs) return;

  for (const config of configs) {
    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildBans,
        ],
      });

      await client.login(config.bot_token);
      guildClients.set(config.guild_id, client);
      console.log(`✅ White-label bot loaded for guild ${config.guild_id}`);
    } catch (error) {
      console.error(`❌ Failed to load white-label bot for guild ${config.guild_id}:`, error);
    }
  }
}

function getClientForGuild(guildId: string): Client {
  return guildClients.get(guildId) || mainClient;
}

// ========== COMMAND HANDLER ==========

mainClient.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, user } = interaction;
  const userId = user.id;

  // Commands qui ne nécessitent pas de licence
  const freeCmds = ['license', 'help', 'ping', 'buy', 'redeem', 'setpaypal', 
                   'listallowners', 'listallbuyers', 'revoke', 'createlicense', 'listlicenses', 'settoken'];

  // Vérification licence (sauf créateurs et commandes gratuites)
  if (guildId && !freeCmds.includes(commandName) && !isCreateur(userId)) {
    const licensed = await hasLicense(guildId);
    if (!licensed) {
      return interaction.reply({
        embeds: [{
          title: '🔒 Licence Requise',
          description: 'Ce serveur n\'a pas de licence active.',
          color: 0xEF4444,
        }],
        ephemeral: true,
      });
    }
  }

  // Handle commands
  switch (commandName) {
    case 'help':
      return handleHelp(interaction);
    case 'ping':
      return interaction.reply(`🏓 Pong! ${mainClient.ws.ping}ms`);
    case 'settoken':
      return handleSetToken(interaction);
    // ... autres commandes
  }
});

// ========== SETTOKEN COMMAND ==========

async function handleSetToken(interaction: any) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // Vérifier que l'utilisateur est le propriétaire du serveur
  const guild = interaction.guild;
  if (guild?.ownerId !== userId && !isCreateur(userId)) {
    return interaction.reply({
      content: '❌ Seul le propriétaire du serveur peut configurer le bot white-label.',
      ephemeral: true,
    });
  }

  const token = interaction.options.getString('token');
  const publicKey = interaction.options.getString('public_key');
  const appId = interaction.options.getString('app_id');

  // Vérifier le token
  try {
    const testClient = new Client({ intents: [GatewayIntentBits.Guilds] });
    await testClient.login(token);
    const botUser = testClient.user;
    testClient.destroy();

    // Sauvegarder en base
    await supabase.from('guild_bot_config').upsert({
      guild_id: guildId,
      bot_token: token,
      bot_public_key: publicKey,
      bot_application_id: appId,
      bot_name: botUser?.username,
      configured_by: userId,
      updated_at: new Date().toISOString(),
    });

    // Charger le nouveau client
    const newClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildBans,
      ],
    });
    await newClient.login(token);
    guildClients.set(guildId, newClient);

    return interaction.reply({
      embeds: [{
        title: '✅ Bot White-Label Configuré',
        description: `Le bot **${botUser?.username}** est maintenant actif pour ce serveur !`,
        color: 0x22C55E,
        fields: [
          { name: '📛 Nom', value: botUser?.username || 'Inconnu', inline: true },
          { name: '🆔 ID', value: botUser?.id || 'Inconnu', inline: true },
        ],
      }],
      ephemeral: true,
    });
  } catch (error) {
    return interaction.reply({
      content: '❌ Token invalide. Vérifie que le token est correct.',
      ephemeral: true,
    });
  }
}

// ========== HELP COMMAND ==========

async function handleHelp(interaction: any) {
  return interaction.reply({
    embeds: [{
      title: '📚 Protect Bot - Commandes',
      description: 
        "**🛡️ Modération**\n" +
        "`/ban` `/unban` `/kick` `/mute` `/unmute`\n" +
        "`/warn` `/clear` `/lock` `/unlock`\n\n" +
        "**⚙️ Protection**\n" +
        "`/antilink` `/antispam` `/antiraid`\n" +
        "`/piconly` `/captcha` `/showpic`\n\n" +
        "**📊 Gestion**\n" +
        "`/ticket` `/welcome` `/goodbye` `/logs`\n" +
        "`/counter` `/temprole` `/note`\n\n" +
        "**👑 Propriétaire**\n" +
        "`/buyer` `/unbuyer` `/setowner` `/delowner`\n\n" +
        "**🔒 Créateur**\n" +
        "`/listallowners` `/listallbuyers` `/listlicenses`\n" +
        "`/revoke` `/createlicense`\n\n" +
        "**⚙️ White-Label**\n" +
        "`/settoken` - Configurer votre propre bot",
      color: 0x2B2D31,
    }],
  });
}

// ========== STARTUP ==========

mainClient.once('ready', () => {
  console.log(`✅ Bot principal connecté: ${mainClient.user?.tag}`);
  console.log(`📊 Serveurs: ${mainClient.guilds.cache.size}`);
});

// Démarrage
async function start() {
  console.log('🚀 Démarrage du bot...');
  
  // Charger les bots white-label
  await loadWhiteLabelBots();
  
  // Connecter le bot principal
  await mainClient.login(process.env.DISCORD_BOT_TOKEN);
}

start().catch(console.error);
```

## 4. package.json

```json
{
  "name": "protect-bot",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "discord.js": "^14.14.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.2"
  }
}
```

## 5. Déploiement sur Railway

1. Créer un compte sur [railway.app](https://railway.app)
2. Nouveau projet → Deploy from GitHub
3. Ajouter les variables d'environnement :
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_APPLICATION_ID`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CREATEURS`
4. Le bot sera en ligne 24/7 !

## 6. Enregistrer les commandes

Créer un fichier `register-commands.ts` :

```typescript
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('settoken')
    .setDescription('⚙️ Configurer votre bot white-label')
    .addStringOption(opt => 
      opt.setName('token')
        .setDescription('Token de votre bot Discord')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('app_id')
        .setDescription('Application ID de votre bot')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('public_key')
        .setDescription('Public Key de votre bot (optionnel)')
        .setRequired(false)),
  // ... autres commandes
].map(cmd => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  console.log('🔄 Enregistrement des commandes...');
  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID!),
    { body: commands }
  );
  console.log('✅ Commandes enregistrées !');
})();
```

## Notes importantes

1. **White-label** : Quand un propriétaire utilise `/settoken`, son bot personnalisé prend le relais pour son serveur
2. **Sécurité** : Les tokens sont stockés en base avec RLS restrictif
3. **Fallback** : Si le token white-label est invalide, le bot principal est utilisé
4. **Créateurs** : Toujours accès à toutes les commandes sans licence

## Prochaines étapes

1. Copier ce code sur ton PC
2. Créer un repo GitHub
3. Déployer sur Railway/Render
4. Le bot sera en ligne !
