# 🤖 Protect Bot - Guide d'installation

## Prérequis
- Node.js 18+
- npm ou yarn

## Installation

```bash
cd bot
npm install
```

## Configuration

1. Copie `.env.example` en `.env` :
```bash
cp .env.example .env
```

2. Remplis les valeurs dans `.env` :
- `DISCORD_BOT_TOKEN` : Token de ton bot Discord
- `DISCORD_APPLICATION_ID` : ID de l'application Discord
- `SUPABASE_URL` : URL de ton projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé service role Supabase
- `CREATEURS` : IDs Discord des créateurs (séparés par virgule)

## Enregistrement des commandes

```bash
npm run register
```

## Lancement

### Développement :
```bash
npm run dev
```

### Production :
```bash
npm run build
npm start
```

## Structure

```
bot/
├── src/
│   ├── index.ts              # Bot principal (toutes les commandes)
│   ├── config.ts             # Configuration
│   ├── register-commands.ts  # Enregistrement slash commands
│   └── utils/
│       ├── supabase.ts       # Client Supabase
│       └── helpers.ts        # Fonctions utilitaires
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Déploiement VPS

1. Clone le repo sur ton VPS
2. `cd bot && npm install && npm run build`
3. Utilise PM2 pour garder le bot en ligne :

```bash
npm install -g pm2
pm2 start dist/index.js --name protect-bot
pm2 save
pm2 startup
```

Le bot sera en ligne 24/7 ! 🎉
