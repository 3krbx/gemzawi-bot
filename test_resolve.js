const { Shoukaku, Connectors } = require('shoukaku');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const nodes = [
    { name: 'Serenetia', url: 'lavalinkv4.serenetia.com:443', auth: 'https://seretia.link/discord', secure: true },
    { name: 'Jirayu', url: 'lavalink.jirayu.net:443', auth: 'youshallnotpass', secure: true }
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 10000
});

client.once('ready', async () => {
    console.log('Client ready, testing resolving on active nodes...');
    await new Promise(r => setTimeout(r, 4000));
    
    for (const [name, node] of shoukaku.nodes) {
        if (node.state === 1) {
            try {
                const res = await node.rest.resolve('https://www.youtube.com/watch?v=kgwziP8m0vc');
                console.log(`Node ${name} resolve result: loadType=${res?.loadType}`);
                if (res?.loadType === 'error') {
                    console.error(`Node ${name} resolve error:`, res.data);
                }
            } catch (err) {
                console.error(`Node ${name} resolve failed:`, err.message);
            }
        } else {
            console.log(`Node ${name} is offline, skipping test.`);
        }
    }
    
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
