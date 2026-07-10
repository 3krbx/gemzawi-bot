const { Shoukaku, Connectors } = require('shoukaku');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const nodes = [
    { name: 'Serenetia', url: 'lavalinkv4.serenetia.com:443', auth: 'https://seretia.link/discord', secure: true },
    { name: 'Jirayu', url: 'lavalink.jirayu.net:443', auth: 'youshallnotpass', secure: true },
    { name: 'Trinium', url: 'lavalink-v4.triniumhost.com:443', auth: 'free', secure: true },
    { name: 'TriniumNode2', url: 'nodelink-02.triniumhost.com:443', auth: 'trinium', secure: true }
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 10000
});

shoukaku.on('error', (name, error) => console.error(`Shoukaku Node ${name} Error:`, error.message || error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} connected!`));
shoukaku.on('disconnect', (name) => console.log(`Lavalink Node ${name} disconnected`));

client.once('ready', async () => {
    console.log('Client ready, checking all nodes in 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));
    
    for (const [name, node] of shoukaku.nodes) {
        console.log(`Node ${name}: state=${node.state} (0=disconnected, 1=connected)`);
    }
    
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
