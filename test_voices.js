const { MsEdgeTTS } = require('msedge-tts');
const tts = new MsEdgeTTS();
async function listVoices() {
    const voices = await tts.getVoices();
    const arabicVoices = voices.filter(v => v.Locale.startsWith('ar-'));
    console.log(arabicVoices.map(v => `${v.Name} (${v.Gender})`));
}
listVoices();
