require('dotenv').config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// State management
const activeChannels = new Set();
const syncChannels = new Map(); // Map<SourceChannelID, TargetChannelID>
const translateChannels = new Map(); // Map<SourceChannelID, {targetChannelId: string, targetLanguage: string}>
let capitalizeEnabled = false;

// Translation function
async function translateText(text, targetLang) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Google API key missing');

  try {
    const response = await axios.post(
      'https://translation.googleapis.com/language/translate/v2',
      { q: text, target: targetLang, format: 'text' },
      { params: { key: apiKey } }
    );
    return response.data.data.translations[0].translatedText;
  } catch (error) {
    console.error('Translation error:', error.response?.data || error.message);
    throw error;
  }
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, channelId } = interaction;

  try {
    switch (commandName) {
      case "ping":
        await interaction.reply("pong!");
        break;
      
      case "start-copy":
        activeChannels.add(channelId);
        await interaction.reply("Started copying messages in this channel!");
        break;
      
      case "stop-copy":
        activeChannels.delete(channelId);
        await interaction.reply("Stopped copying messages in this channel!");
        break;
      
      case "capitalize":
        capitalizeEnabled = interaction.options.getBoolean("enabled");
        await interaction.reply(`Capitalization ${capitalizeEnabled ? "enabled" : "disabled"}!`);
        break;

      case "sync":
        const targetChannel = interaction.options.getChannel("channel");
        const permissions = targetChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has("SendMessages")) {
          return interaction.reply("I don't have permission to send messages in that channel!");
        }
        syncChannels.set(channelId, targetChannel.id);
        await interaction.reply(`Messages will now be copied to ${targetChannel.toString()}!`);
        break;

      case "synch-translate":
        const targetLanguage = interaction.options.getString("language");
        const translateChannel = interaction.options.getChannel("channel");
        
        const channelPermissions = translateChannel.permissionsFor(interaction.guild.members.me);
        if (!channelPermissions.has("SendMessages")) {
          return interaction.reply("I can't send messages in that channel!");
        }

        translateChannels.set(channelId, {
          targetChannelId: translateChannel.id,
          targetLanguage: targetLanguage.toLowerCase()
        });
        await interaction.reply(`Translating messages to ${targetLanguage} in ${translateChannel.toString()}!`);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle same-channel copying
  if (activeChannels.has(message.channelId)) {
    let content = message.content;
    if (capitalizeEnabled) content = content.toUpperCase();
    
    try {
      await message.channel.send(content);
    } catch (error) {
      console.error("Error copying message:", error);
    }
  }

  // Handle cross-channel syncing
  if (syncChannels.has(message.channelId)) {
    const targetChannelId = syncChannels.get(message.channelId);
    const targetChannel = await client.channels.fetch(targetChannelId);
    
    let content = message.content;
    if (capitalizeEnabled) content = content.toUpperCase();

    try {
      await targetChannel.send(content);
    } catch (error) {
      console.error(`Error syncing message to ${targetChannelId}:`, error);
    }
  }

  // Handle translation syncing
  if (translateChannels.has(message.channelId) && message.content.trim()) {
    const { targetChannelId, targetLanguage } = translateChannels.get(message.channelId);
    
    try {
      const targetChannel = await client.channels.fetch(targetChannelId);
      const translatedText = await translateText(message.content, targetLanguage);
      await targetChannel.send(translatedText);
    } catch (error) {
      console.error(`Error translating message to ${targetLanguage}:`, error);
      // Optionally send error to channel or log somewhere
    }
  }
});

client.login(process.env.DISCORD_TOKEN);