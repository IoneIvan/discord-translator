const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("The first command of everybot."),
  new SlashCommandBuilder()
    .setName("start-copy")
    .setDescription("Start copying messages in this channel."),
  new SlashCommandBuilder()
    .setName("stop-copy")
    .setDescription("Stop copying messages in this channel."),
  new SlashCommandBuilder()
    .setName("capitalize")
    .setDescription("Toggle capitalization for copied messages.")
    .addBooleanOption(option =>
      option.setName("enabled")
        .setDescription("Enable/disable capitalization")
        .setRequired(true)
    ),
    new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Copy new messages to a specified channel")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Target channel to copy messages to")
        .setRequired(true)
    ),
    new SlashCommandBuilder()
    .setName("synch-translate")
    .setDescription("Translate messages to a language and sync to a channel")
    .addStringOption(option =>
      option.setName("language")
      .setDescription("Target language code (e.g., 'pt', 'es')")
      .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName("channel")
      .setDescription("Target channel to send translated messages")
      .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function deployCommands() {
  try {
    await rest.put(
      //Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), // for testing on server
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}

deployCommands();