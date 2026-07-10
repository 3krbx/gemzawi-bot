const play = require('play-dl');
async function test() {
    console.log("Validating...");
    const type = await play.validate("https://www.youtube.com/watch?v=nrch1L7MPa4&list=RDnrch1L7MPa4&start_radio=1");
    console.log("Type:", type);
    console.log("Getting info...");
    const info = await play.video_info("https://www.youtube.com/watch?v=nrch1L7MPa4&list=RDnrch1L7MPa4&start_radio=1");
    console.log("Title:", info.video_details.title);
}
test().catch(console.error);
