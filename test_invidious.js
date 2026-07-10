const fetch = require('node-fetch');

const INVIDIOUS_INSTANCES = [
    'inv.nadeko.net',
    'invidious.fdn.fr',
    'yt.cdaut.de',
    'invidious.privacydev.net',
    'vid.puffyan.us'
];

async function getInvidiousStreamUrl(videoId) {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            console.log(`Trying ${instance}...`);
            const res = await fetch(`https://${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats,title`, {
                timeout: 8000
            });
            if (!res.ok) {
                console.log(`${instance} returned status ${res.status}`);
                continue;
            }
            const data = await res.json();
            const audioFormats = (data.adaptiveFormats || []).filter(f =>
                f.type && f.type.startsWith('audio')
            );
            if (audioFormats.length === 0) {
                console.log(`${instance} returned no audio formats`);
                continue;
            }
            audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            console.log(`SUCCESS: Got stream from ${instance}`);
            return audioFormats[0].url;
        } catch (e) {
            console.log(`${instance} failed: ${e.message}`);
            continue;
        }
    }
    throw new Error('All Invidious instances failed!');
}

getInvidiousStreamUrl('nrch1L7MPa4').then(url => {
    console.log("Stream URL obtained! Length:", url.length);
    console.log(url.substring(0, 100) + "...");
}).catch(e => {
    console.error("ERROR:", e.message);
});
