require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
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
const translateChannels = new Map(); // Map<SourceChannelID, {targetChannelId, targetLanguage, imageSync, reactionSync}>
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

        translateChannels.set(channelId, {
          targetChannelId: translateChannel.id,
          targetLanguage: targetLanguage.toLowerCase(),
          imageSync: false,
          reactionSync: false
        });
        await interaction.reply(`Translation sync configured for ${translateChannel.toString()} in ${targetLanguage}!`);
        break;
      }

      case "toggle-image-sync": {
        const config = translateChannels.get(channelId);
        if (!config) {
          return interaction.reply("Set up translation sync first using /setup-translation-sync");
        }
        config.imageSync = interaction.options.getBoolean("enabled");
        await interaction.reply(`Image synchronization ${config.imageSync ? "enabled" : "disabled"}!`);
        break;
      }

      case "toggle-reaction-sync": {
        const config = translateChannels.get(channelId);
        if (!config) {
          return interaction.reply("Set up translation sync first using /setup-translation-sync");
        }
        config.reactionSync = interaction.options.getBoolean("enabled");
        await interaction.reply(`Reaction synchronization ${config.reactionSync ? "enabled" : "disabled"}!`);
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

  const config = translateChannels.get(message.channelId);
  const targetChannel = await client.channels.fetch(config.targetChannelId);

  try {
    // Get the author's server-specific display name
    const displayName = message.member?.displayName || message.author.username;

    // Handle image synchronization
    if (config.imageSync && message.attachments.size > 0) {
      const imageMessages = await Promise.all(
        message.attachments.map(attachment =>
          targetChannel.send({ 
            files: [attachment.url],
            content: `**${displayName}:**` // Include display name with images
          })
        )
      );
      imageMessages.forEach(sentMessage => {
        messageIdMap.set(message.id, sentMessage.id);
      });
    }

    // Handle text translation
    if (message.content.trim()) {
      const translatedText = await translateText(message.content, config.targetLanguage);
      const sentMessage = await targetChannel.send(`**${displayName}:** ${translatedText}`);
      messageIdMap.set(message.id, sentMessage.id);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    const config = translateChannels.get(reaction.message.channelId);
    if (!config?.reactionSync) return;

    const targetMessageId = messageIdMap.get(reaction.message.id);
    if (!targetMessageId) return;

    const targetChannel = await client.channels.fetch(config.targetChannelId);
    const targetMessage = await targetChannel.messages.fetch(targetMessageId);
    
    await targetMessage.react(reaction.emoji);
  } catch (error) {
    console.error('Error syncing reaction:', error);
  }
});

client.login(process.env.DISCORD_TOKEN);