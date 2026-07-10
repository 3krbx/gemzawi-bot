const { Shoukaku, Connectors } = require('shoukaku');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const nodes = [
    { name: 'Jirayu', url: 'lavalink.jirayu.net:443', auth: 'youshallnotpass', secure: true }
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 10000
});

shoukaku.on('error', (name, error) => console.log(`Shoukaku Node ${name} Error:`, error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} connected!`));

client.once('ready', async () => {
    console.log('Client ready, testing Google TTS URL resolve...');
    await new Promise(r => setTimeout(r, 4000));
    
    const text = "السلام عليكم ورحمة الله وبركاته";
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ar&client=tw-ob`;
    
    const node = shoukaku.options.nodeResolver(shoukaku.nodes);
    if (node) {
        try {
            const res = await node.rest.resolve(ttsUrl);
            console.log(`Resolve result: loadType=${res?.loadType}`);
            if (res?.loadType === 'track') {
                console.log(`Successfully resolved Google TTS! Title: ${res.data.info.title}`);
            } else {
                console.log(`Failed to resolve Google TTS:`, res);
            }
        } catch (err) {
            console.error(`Resolve failed:`, err.message);
        }
    } else {
        console.log(`No active node found.`);
    }
    
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
