const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const fs = require('fs');

async function test() {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('ar-EG-SalmaNeural', OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
    
    const reqDir = path.join(__dirname, 'test_tts_dir');
    if (!fs.existsSync(reqDir)) fs.mkdirSync(reqDir);
    
    try {
        console.log("Trying to write to reqDir directly...");
        await tts.toFile(reqDir, "لول يعم");
        console.log("Success with reqDir!");
    } catch (e) {
        console.error("Error with reqDir:", e.message);
    }

    try {
        console.log("Trying to write to filePath...");
        const filePath = path.join(reqDir, 'output.webm');
        await tts.toFile(filePath, "لول يعم");
        console.log("Success with filePath!");
    } catch (e) {
        console.error("Error with filePath:", e.message);
    }
}

test();
