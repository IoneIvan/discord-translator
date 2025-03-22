const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName("setup-translation-sync")
    .setDescription("Set up translation synchronization between channels")
    .addStringOption(option =>
      option.setName("language")
        .setDescription("Target language code (e.g., 'pt', 'es')")
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Target channel for translated messages")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("toggle-image-sync")
    .setDescription("Enable/disable image synchronization for translations")
    .addBooleanOption(option =>
      option.setName("enabled")
        .setDescription("Enable image synchronization")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("toggle-reaction-sync")
    .setDescription("Enable/disable reaction synchronization for translations")
    .addBooleanOption(option =>
      option.setName("enabled")
        .setDescription("Enable reaction synchronization")
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function deployCommands() {
  try {
    await rest.put(
      //Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), // for testing on
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}

deployCommands();