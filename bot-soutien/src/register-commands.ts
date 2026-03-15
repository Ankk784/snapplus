import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('soutien')
    .setDescription('⚙️ Configurer le système de soutien')
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('📋 Configurer les URLs et le rôle soutien')
        .addRoleOption(o => o.setName('role').setDescription('Rôle à donner aux soutiens').setRequired(true))
        .addStringOption(o => o.setName('url1').setDescription('URL 1 à détecter dans la bio').setRequired(true))
        .addStringOption(o => o.setName('url2').setDescription('URL 2 (optionnel)'))
        .addStringOption(o => o.setName('url3').setDescription('URL 3 (optionnel)'))
        .addStringOption(o => o.setName('url4').setDescription('URL 4 (optionnel)'))
        .addStringOption(o => o.setName('url5').setDescription('URL 5 (optionnel)'))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('📄 Voir la config actuelle et les membres soutien')
    )
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('🔄 Forcer une vérification des bios maintenant')
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('🗑️ Supprimer la configuration soutien')
    ),
].map(cmd => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  console.log(`🔄 Enregistrement de ${commands.length} commande(s)...`);
  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID!),
    { body: commands }
  );
  console.log(`✅ Commandes enregistrées !`);
})();
