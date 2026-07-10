const youtubedl = require('youtube-dl-exec');
async function test() {
    try {
        console.log("Searching via yt-dlp...");
        const output = await youtubedl('ytsearch1:عمرو دياب يهمك في ايه', {
            dumpJson: true,
            noWarnings: true
        });
        const video = output.entries ? output.entries[0] : output;
        console.log("Found:", video.title, video.webpage_url);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
