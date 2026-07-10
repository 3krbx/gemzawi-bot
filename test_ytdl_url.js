const youtubedl = require('youtube-dl-exec');
async function test() {
    try {
        const output = await youtubedl('https://www.youtube.com/watch?v=nrch1L7MPa4', {
            dumpJson: true,
            format: 'bestaudio',
            noWarnings: true,
            preferFreeFormats: true
        });
        console.log("Stream URL:", output.url);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
