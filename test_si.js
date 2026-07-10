const play = require('play-dl');
async function test() {
    const type = await play.validate("https://youtu.be/nrch1L7MPa4?si=6TDVfFqftmJbEa46");
    console.log("Type:", type);
}
test();
