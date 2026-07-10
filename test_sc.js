const play = require('play-dl');
async function test() {
    console.log("Searching SoundCloud...");
    try {
        const res = await play.search("عمرو دياب يهمك في ايه", { limit: 1, source: { soundcloud: 'tracks' } });
        console.log(res);
    } catch (e) {
        console.error(e);
    }
}
test();
