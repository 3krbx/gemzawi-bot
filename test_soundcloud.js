const Soundcloud = require('soundcloud.ts').default;
const fetch = require('node-fetch');

async function test() {
    try {
        const sc = new Soundcloud();
        console.log("Searching SoundCloud...");
        const results = await sc.tracks.search({ q: 'عمرو دياب يهمك في ايه', limit: 1 });
        const track = results.collection[0];
        console.log("Track:", track.title);
        
        // Get progressive stream (not HLS)
        const progressiveTranscoding = track.media.transcodings.find(t => t.format && t.format.protocol === 'progressive');
        const hlsTranscoding = track.media.transcodings.find(t => t.format && t.format.protocol === 'hls');
        const transcoding = progressiveTranscoding || hlsTranscoding;
        
        console.log("All transcodings:", JSON.stringify(track.media.transcodings.map(t => ({url: t.url.substring(0,60), preset: t.preset}))));
        
        if (!transcoding) {
            console.log("No transcoding found!");
            return;
        }
        
        const clientId = sc.api.clientId;
        console.log("Client ID:", clientId);
        
        // Fetch the actual stream URL
        const streamRes = await fetch(`${transcoding.url}?client_id=${clientId}&track_authorization=${track.track_authorization}`);
        console.log("Stream response status:", streamRes.status);
        const streamData = await streamRes.json();
        console.log("Stream URL:", streamData.url ? streamData.url.substring(0, 100) : JSON.stringify(streamData).substring(0, 200));
    } catch(e) {
        console.error("Error:", e.message);
        console.error(e.stack);
    }
}
test();
