const { Shoukaku, Connectors } = require('shoukaku');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const nodes = [
    { name: 'Serenetia', url: 'lavalinkv4.serenetia.com:443', auth: 'https://seretia.link/discord', secure: true },
    { name: 'Jirayu', url: 'lavalink.jirayu.net:443', auth: 'youshallnotpass', secure: true },
    { name: 'Snail', url: 'lavalink.snail.net:443', auth: 'youshallnotpass', secure: true } // dummy node just in case
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 1,
    restTimeout: 5000
});

shoukaku.on('error', (name, error) => console.log(`Shoukaku Node ${name} Error:`, error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} connected!`));

client.once('ready', () => {
    console.log('Client ready, waiting 5 seconds for nodes to connect...');
    setTimeout(() => {
        console.log('Nodes status:');
        shoukaku.nodes.forEach(node => {
            console.log(`- ${node.name}: state=${node.state}`);
        });
        process.exit(0);
    }, 5000);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
