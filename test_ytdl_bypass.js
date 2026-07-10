const youtubedl = require('youtube-dl-exec');
async function test() {
    try {
        console.log("Fetching with android client bypass...");
        const output = await youtubedl('https://youtu.be/nrch1L7MPa4', {
            dumpJson: true,
            format: 'bestaudio',
            noWarnings: true,
            preferFreeFormats: true,
            extractorArgs: 'youtube:player_client=android'
        });
        console.log("Stream URL:", output.url);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
