const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const fs = require('fs');

async function generate() {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('ar-EG-SalmaNeural', OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
    
    const reqDir = path.join(__dirname, 'test_playback');
    if (!fs.existsSync(reqDir)) fs.mkdirSync(reqDir);
    
    // Test with silence
    const textWithSilence = "، ، لول يعم";
    console.log("Generating TTS for:", textWithSilence);
    const result = await tts.toFile(reqDir, textWithSilence);
    
    const stats = fs.statSync(result.audioFilePath);
    console.log("File generated at:", result.audioFilePath);
    console.log("File size in bytes:", stats.size);
    tts.close();
}
generate();
