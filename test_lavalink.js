const { Shoukaku, Connectors } = require('shoukaku');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const nodes = [
    { name: 'Node1', url: 'lavalink.devamop.in:443', auth: 'DevamopIndia', secure: true },
    { name: 'Node2', url: 'lava.link:80', auth: 'dismusic', secure: false },
    { name: 'Node3', url: 'lavalink.jirayu.net:13592', auth: 'youshallnotpass', secure: false },
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 10000
});

shoukaku.on('error', (_, error) => console.error('Shoukaku Error:', error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} connected!`));
shoukaku.on('disconnect', (name) => console.log(`Lavalink Node ${name} disconnected`));

client.once('ready', async () => {
    console.log('Client ready, checking Lavalink nodes...');
    await new Promise(r => setTimeout(r, 3000));
    
    for (const [name, node] of shoukaku.nodes) {
        console.log(`Node ${name}: connected=${node.state}`);
    }
    
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
