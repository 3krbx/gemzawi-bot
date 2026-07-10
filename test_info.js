const play = require('play-dl');
async function test() {
    try {
        console.log("Fetching info...");
        const info = await play.video_info("https://youtu.be/nrch1L7MPa4?si=6TDVfFqftmJbEa46");
        console.log("Title:", info.video_details.title);
    } catch (e) {
        console.log("Error:", e);
    }
}
test();
