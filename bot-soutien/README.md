# 🤝 Bot Soutien - Détection automatique par bio/statut

Bot Discord qui détecte automatiquement si un membre a une URL configurée dans son **statut personnalisé** ou ses **activités**, et lui attribue un rôle soutien.

## 📦 Installation

```bash
cd bot-soutien
npm install
cp .env.example .env
```

Remplis le `.env` avec le token de ton **2ème bot Discord** (pas le même que Protect Bot).

## 🔧 Configuration Discord Developer Portal

1. Va sur https://discord.com/developers/applications
2. Crée une **nouvelle application** (ex: "Soutien Bot")
3. Va dans **Bot** → copie le token
4. Active les **Privileged Gateway Intents** :
   - ✅ PRESENCE INTENT
   - ✅ SERVER MEMBERS INTENT
5. Va dans **OAuth2 → URL Generator** :
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Manage Roles`, `Send Messages`, `Use Slash Commands`
6. Invite le bot sur ton serveur avec le lien généré

## 🚀 Lancement

```bash
# Enregistrer les commandes slash
npm run register

# Compiler et lancer
npm run build
npm start

# Ou en dev
npm run dev

# Avec PM2 (24/7)
pm2 start dist/index.js --name soutien-bot
```

## 📋 Commandes

| Commande | Description |
|----------|-------------|
| `/soutien config` | Configurer le rôle et les URLs à détecter |
| `/soutien list` | Voir la config et les membres soutien |
| `/soutien check` | Forcer une vérification de tous les membres |
| `/soutien reset` | Supprimer la configuration |

## 🔍 Fonctionnement

1. Un admin fait `/soutien config` avec le rôle et les URLs
2. Le bot vérifie périodiquement les statuts de tous les membres
3. Si un membre a une URL configurée dans son statut → il reçoit le rôle
4. Si un membre retire l'URL → le rôle est retiré
5. Détection en temps réel quand un membre change son statut

## ⚠️ Important

- Le bot doit avoir un rôle **au-dessus** du rôle soutien dans la hiérarchie
- Les intents **Presence** et **Server Members** doivent être activés
- La config est en mémoire : elle se réinitialise au redémarrage du bot
