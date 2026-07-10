const youtubedl = require('youtube-dl-exec');
async function test() {
    try {
        console.log("Fetching info via yt-dlp...");
        const output = await youtubedl('https://youtu.be/nrch1L7MPa4?si=6TDVfFqftmJbEa46', {
            dumpJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            ]
        });
        console.log(output.title);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
