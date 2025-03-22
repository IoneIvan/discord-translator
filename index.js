const { Client, Intents, MessageEmbed } = require('discord.js');
const client = new Client({ 
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES
  ] 
});

// Store channel forwarding mappings: Map<sourceChannelId, destinationChannelIds[]>
const forwardMap = new Map();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if the message is a command
  if (message.content.startsWith('!')) {
    handleCommand(message);
    return;
  }

  // Check if message is in a source channel
  if (forwardMap.has(message.channel.id)) {
    const destinations = forwardMap.get(message.channel.id);
    
    for (const destId of destinations) {
      const destChannel = client.channels.cache.get(destId);
      if (!destChannel) continue;

      // Create embed with original message and author info
      const embed = new MessageEmbed()
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(message.content)
        .setFooter({ text: `Forwarded from #${message.channel.name}` })
        .setTimestamp();

      // Include attachments if any
      const files = message.attachments.map(attachment => attachment.url);

      try {
        await destChannel.send({
          embeds: [embed],
          files: files
        });
      } catch (error) {
        console.error(`Error forwarding message to ${destChannel.name}:`, error);
      }
    }
  }
});

function handleCommand(message) {
  const args = message.content.slice(1).split(' ');
  const command = args.shift().toLowerCase();

  switch (command) {
    case 'setforward':
      if (args.length < 2) {
        return message.reply('Usage: `!setforward <sourceChannelID> <destinationChannelID>`');
      }

      const [sourceId, destId] = args;
      setForwarding(message, sourceId, destId);
      break;

    case 'removeforward':
      if (args.length < 2) {
        return message.reply('Usage: `!removeforward <sourceChannelID> <destinationChannelID>`');
      }

      const [sourceIdRemove, destIdRemove] = args;
      removeForwarding(message, sourceIdRemove, destIdRemove);
      break;

    default:
      message.reply('Unknown command. Available commands: `!setforward`, `!removeforward`');
  }
}

function setForwarding(message, sourceId, destId) {
  const sourceChannel = client.channels.cache.get(sourceId);
  const destChannel = client.channels.cache.get(destId);

  if (!sourceChannel || !destChannel) {
    return message.reply('Invalid channel IDs. Make sure both channels exist and the bot has access.');
  }

  if (!forwardMap.has(sourceId)) {
    forwardMap.set(sourceId, []);
  }

  const destinations = forwardMap.get(sourceId);
  if (!destinations.includes(destId)) {
    destinations.push(destId);
    message.reply(`Messages from ${sourceChannel.name} will now be forwarded to ${destChannel.name}`);
  } else {
    message.reply('This forwarding configuration already exists.');
  }
}

function removeForwarding(message, sourceId, destId) {
  if (!forwardMap.has(sourceId)) {
    return message.reply('No forwarding configured for this source channel.');
  }

  const destinations = forwardMap.get(sourceId);
  const index = destinations.indexOf(destId);

  if (index === -1) {
    return message.reply('This forwarding configuration does not exist.');
  }

  destinations.splice(index, 1);
  if (destinations.length === 0) {
    forwardMap.delete(sourceId);
  }

  const sourceChannel = client.channels.cache.get(sourceId);
  const destChannel = client.channels.cache.get(destId);
  
  message.reply(`Removed forwarding from ${sourceChannel?.name || 'unknown'} to ${destChannel?.name || 'unknown'}`);
}

client.login(DISCORD_TOKEN);