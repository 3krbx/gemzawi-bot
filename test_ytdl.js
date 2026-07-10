const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

async function test() {
    console.log("Searching...");
    const r = await ytSearch("عمرو دياب يهمك في ايه");
    const video = r.videos[0];
    console.log("Found:", video.title, video.url);
    
    console.log("Testing stream fetch...");
    const stream = ytdl(video.url, { filter: 'audioonly' });
    stream.on('info', (info) => {
        console.log("Stream info loaded!");
        process.exit(0);
    });
    stream.on('error', (err) => {
        console.error("Stream error:", err);
    });
}
test();
