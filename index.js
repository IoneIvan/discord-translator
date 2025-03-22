require('dotenv').config();
const { Client, GatewayIntentBits } = require("discord.js");

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
let capitalizeEnabled = false;

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
        
        // Check bot permissions in target channel
        const permissions = targetChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has("SendMessages")) {
          return interaction.reply("I don't have permission to send messages in that channel!");
        }

        syncChannels.set(channelId, targetChannel.id);
        await interaction.reply(`Messages will now be copied to ${targetChannel.toString()}!`);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
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
});


client.login(process.env.DISCORD_TOKEN);