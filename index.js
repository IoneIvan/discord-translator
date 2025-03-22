require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionFlagsBits } = require("discord.js");
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Added for member data
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// State management
// Change from Map<SourceChannelID, singleConfig> to Map<SourceChannelID, Array<config>>
const translateChannels = new Map(); // Map<SourceChannelID, Array<{targetChannelId, targetLanguage, imageSync, reactionSync}>>

const messageIdMap = new Map(); // Map<sourceMessageId, targetMessageId>

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

  // Check if user has administrator permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ You need administrator permissions to use this command!",
      ephemeral: true
    });
  }

  const { commandName, channelId } = interaction;

  try {
    switch (commandName) {
      case "setup-translation-sync": {
        const targetLanguage = interaction.options.getString("language");
        const translateChannel = interaction.options.getChannel("channel");
        
        const permissions = translateChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has("SendMessages")) {
          return interaction.reply("I can't send messages in that channel!");
        }
      
        const config = {
          targetChannelId: translateChannel.id,
          targetLanguage: targetLanguage.toLowerCase(),
          imageSync: false,
          reactionSync: false
        };
      
        const existingConfigs = translateChannels.get(channelId) || [];
        // Update existing config if channel already exists
        const existingIndex = existingConfigs.findIndex(c => c.targetChannelId === translateChannel.id);
        if (existingIndex !== -1) {
          existingConfigs[existingIndex] = config;
        } else {
          existingConfigs.push(config);
        }
        
        translateChannels.set(channelId, existingConfigs);
        await interaction.reply(`Translation sync configured for ${translateChannel.toString()} in ${targetLanguage}!`);
        break;
      }

      case "toggle-image-sync": {
        const targetChannel = interaction.options.getChannel("channel");
        const enabled = interaction.options.getBoolean("enabled");
      
        const configs = translateChannels.get(channelId);
        if (!configs) {
          return interaction.reply("Set up translation sync first using /setup-translation-sync");
        }
      
        const targetConfig = configs.find(c => c.targetChannelId === targetChannel.id);
        if (!targetConfig) {
          return interaction.reply("No configuration found for the specified target channel.");
        }
      
        targetConfig.imageSync = enabled;
        await interaction.reply(`Image synchronization ${enabled ? "enabled" : "disabled"} for ${targetChannel.toString()}!`);
        break;
      }
      
// do the reaction synch
case "toggle-reaction-sync": {
  const targetChannel = interaction.options.getChannel("channel");
  const enabled = interaction.options.getBoolean("enabled");

  const configs = translateChannels.get(channelId);
  if (!configs) {
    return interaction.reply("Set up translation sync first using /setup-translation-sync");
  }

  const targetConfig = configs.find(c => c.targetChannelId === targetChannel.id);
  if (!targetConfig) {
    return interaction.reply("No configuration found for the specified target channel.");
  }

  targetConfig.reactionSync = enabled;
  await interaction.reply(`Reaction synchronization ${enabled ? "enabled" : "disabled"} for ${targetChannel.toString()}!`);
  break;
}
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    await interaction.reply({ content: 'Command execution failed!', ephemeral: true });
  }
});

// In the messageCreate handler:
client.on("messageCreate", async (message) => {
  if (message.author.bot || !translateChannels.has(message.channelId)) return;

  const configs = translateChannels.get(message.channelId);
  const displayName = message.member?.displayName || message.author.username;

  for (const config of configs) {
    try {
      const targetChannel = await client.channels.fetch(config.targetChannelId);
      
      // Handle image sync
      if (config.imageSync && message.attachments.size > 0) {
        await Promise.all(message.attachments.map(attachment => 
          targetChannel.send({
            files: [attachment.url],
            content: `**${displayName}:**`
          })
        ));
      }

      // Handle text translation
      if (message.content.trim()) {
        const translatedText = await translateText(message.content, config.targetLanguage);
        const sentMessage = await targetChannel.send(`**${displayName}:** ${translatedText}`);
        // Update messageIdMap to track multiple targets
        const existingMap = messageIdMap.get(message.id) || new Map();
        existingMap.set(config.targetChannelId, sentMessage.id);
        messageIdMap.set(message.id, existingMap);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    const configs = translateChannels.get(reaction.message.channelId);
    if (!configs) return;

    const targetMessages = messageIdMap.get(reaction.message.id);
    if (!targetMessages) return;

    for (const config of configs) {
      if (!config.reactionSync) continue;
      
      const targetMessageId = targetMessages.get(config.targetChannelId);
      if (!targetMessageId) continue;

      const targetChannel = await client.channels.fetch(config.targetChannelId);
      const targetMessage = await targetChannel.messages.fetch(targetMessageId);
      await targetMessage.react(reaction.emoji);
    }
  } catch (error) {
    console.error('Error syncing reaction:', error);
  }
});

client.login(process.env.DISCORD_TOKEN);