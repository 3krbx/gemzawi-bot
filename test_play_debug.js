const { Shoukaku, Connectors } = require('shoukaku');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages] });

const nodes = [
    { name: 'Jirayu', url: 'lavalink.jirayu.net:443', auth: 'youshallnotpass', secure: true },
    { name: 'Serenetia', url: 'lavalinkv4.serenetia.com:443', auth: 'https://seretia.link/discord', secure: true }
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 10000
});

shoukaku.on('error', (name, error) => console.log(`Shoukaku Error:`, error || name));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} connected!`));

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // Replace with a specific guild and channel for testing
    // To not bother the user, we'll just test resolving and play logic without actual channel unless we must.
    // Actually we can just exit if we don't know the channel ID.
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
