const { exec } = require('youtube-dl-exec');
const fs = require('fs');

async function test() {
    console.log("Streaming via yt-dlp...");
    const subprocess = exec('https://www.youtube.com/watch?v=nrch1L7MPa4', {
        output: '-',
        format: 'bestaudio',
        limitRate: '1M',
        rmCacheDir: true,
        noWarnings: true
    }, { stdio: ['ignore', 'pipe', 'ignore'] });
    
    subprocess.stdout.pipe(fs.createWriteStream('test_audio.webm'));
    
    setTimeout(() => {
        subprocess.kill();
        console.log("Stream killed after 5 seconds");
        const stats = fs.statSync('test_audio.webm');
        console.log("File size:", stats.size);
    }, 5000);
}
test();
