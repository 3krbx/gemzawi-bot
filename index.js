const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Shoukaku, Connectors } = require('shoukaku');
require('dotenv').config();

// دوال حفظ واسترجاع بيانات العقوبات
const PUNISHMENTS_FILE = path.join(__dirname, 'punishments.json');
function loadPunishments() {
    if (!fs.existsSync(PUNISHMENTS_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(PUNISHMENTS_FILE, 'utf8')); } catch(e) { return {}; }
}
function savePunishments(data) {
    fs.writeFileSync(PUNISHMENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}
// سيرفر ويب بسيط عشان الاستضافات المجانية (زي Render أو Koyeb) متقفلش البوت
const express = require('express');
const app = express();
const ttsDir = path.join(__dirname, 'tts_temp');
if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir);
app.use('/tts', express.static(ttsDir));

app.get('/', (req, res) => res.send('Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [
    { name: 'Serenetia', url: 'lavalinkv4.serenetia.com:443', auth: 'https://seretia.link/discord', secure: true },
    { name: 'Jirayu', url: 'lavalink.jirayu.net:443', auth: 'youshallnotpass', secure: true }
], {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 10000
});

shoukaku.on('error', (name, error) => console.error(`Shoukaku Node ${name} Error:`, error.message || error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} connected!`));
shoukaku.on('disconnect', (name) => console.log(`Lavalink Node ${name} disconnected`));

let voicePlayer = null;
let queue = [];
let isPlaying = false;
let currentResourceFile = null;
let currentPlaybackType = null;

// قائمة البلاك ليست (الأيديهات الممنوعة من استخدام البوت)
const BLACKLIST = [];

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // تسجيل السلاش كوماند في كل السيرفرات اللي البوت فيها (أسرع من التسجيل العالمي)
    const commandsData = [
        {
            name: 'punish',
            description: 'عزل مخصي وتغيير اسمه وإعطاءه رول',
            options: [
                {
                    name: 'user',
                    type: ApplicationCommandOptionType.User,
                    description: 'الشخص اللي عايز تعاقبه',
                    required: true,
                },
                {
                    name: 'new_name',
                    type: ApplicationCommandOptionType.String,
                    description: 'الاسم الجديد',
                    required: true,
                },
                {
                    name: 'reason',
                    type: ApplicationCommandOptionType.String,
                    description: 'سبب العقاب',
                    required: true,
                }
            ]
        }
    ];

    client.guilds.cache.forEach(async guild => {
        try {
            await guild.commands.set(commandsData);
            console.log(`Registered slash commands for guild ${guild.name}`);
        } catch (err) {
            console.error(`Failed to register slash commands for guild ${guild.name}`, err);
        }
    });

    // فحص العقوبات المنتهية كل دقيقة
    setInterval(async () => {
        const data = loadPunishments();
        let changed = false;
        const now = Date.now();

        for (const guildId in data) {
            for (const userId in data[guildId]) {
                const punishInfo = data[guildId][userId];
                if (now >= punishInfo.unpunishAt) {
                    try {
                        const guild = await client.guilds.fetch(guildId).catch(()=>null);
                        if (guild) {
                            const member = await guild.members.fetch(userId).catch(()=>null);
                            if (member) {
                                // سحب رول العقاب
                                const roleId = '1144243984949055538';
                                await member.roles.remove(roleId).catch(()=>{});
                                // استرجاع الرولات القديمة
                                if (punishInfo.oldRoles && punishInfo.oldRoles.length > 0) {
                                    for (const rId of punishInfo.oldRoles) {
                                        await member.roles.add(rId).catch(()=>{});
                                    }
                                }
                                // استرجاع الاسم
                                await member.setNickname(punishInfo.oldName).catch(()=>{});
                            }
                        }
                    } catch (e) {
                        console.error("Error restoring user", e);
                    }
                    
                    delete data[guildId][userId];
                    changed = true;
                }
            }
        }
        if (changed) savePunishments(data);
    }, 60000);
});

// تحويل الفرانكو لعربي عشان البوت يفهمه
function convertFranco(text) {
    // لو النص كله عربي مش هنغير فيه حاجة
    if (!/[a-zA-Z0-9]/.test(text)) return text;

    const francoMap = {
        'th': 'ث', 'sh': 'ش', 'gh': 'غ', 'kh': 'خ', 'dh': 'ذ', 'ch': 'تش',
        '3\'': 'غ', '7\'': 'خ',
        'a': 'ا', 'b': 'ب', 't': 'ت', 'j': 'ج', '7': 'ح', 
        '5': 'خ', 'd': 'د', 'z': 'ز', 'r': 'ر', 's': 'س', 
        '9': 'ص', '6': 'ط', '3': 'ع', 'g': 'ج', 'f': 'ف', 'q': 'ق', '8': 'ق', 
        'k': 'ك', 'c': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن', 'h': 'ه', 'w': 'و', 
        'o': 'و', 'u': 'و', 'y': 'ي', 'i': 'ي', 'e': 'ي', 'p': 'ب', 'v': 'ف',
        '2': 'أ', 'x': 'كس'
    };
    
    const sortedKeys = Object.keys(francoMap).sort((a, b) => b.length - a.length);
    const regex = new RegExp(sortedKeys.map(k => k.replace(/'/g, "\\'")).join('|'), 'gi');
    
    return text.replace(regex, match => francoMap[match.toLowerCase()] || match);
}

// إضافة علامات ترقيم ذكية عشان البوت ياخد نفس ويسأل طبيعي
function addSmartPunctuation(text) {
    // 1. إضافة علامة استفهام للأسئلة
    const questionWords = ['ليه', 'إزاي', 'ازاي', 'فين', 'امتى', 'إمتى', 'مين', 'بكام', 'هل', 'ايه', 'إيه', 'بجد', 'اومال'];
    const hasQuestionWord = questionWords.some(word => {
        const regex = new RegExp(`(^|\\s)${word}(\\s|$)`, 'i');
        return regex.test(text);
    });
    
    if (hasQuestionWord && !text.includes('؟') && !text.includes('?')) {
        text = text.trim() + '؟';
    }

    // 2. إضافة فواصل قبل الكلمات اللي محتاجة وقفة (نَفَس)
    const pauseWords = ['يا', 'بس', 'عشان', 'علشان', 'لكن', 'بقولك', 'طيب', 'طب', 'وبعدين'];
    pauseWords.forEach(word => {
        // لو مفيش قبلها فاصلة، حط فاصلة
        const regex = new RegExp(`([^،,])\\s+(${word})(\\s|$)`, 'g');
        text = text.replace(regex, '$1، $2$3');
    });

    return text.replace(/\s+/g, ' ').trim();
}

function cleanupCurrentResourceFile() {
    if (currentResourceFile) {
        try {
            if (fs.existsSync(currentResourceFile.file)) fs.unlinkSync(currentResourceFile.file);
            if (currentResourceFile.dir && fs.existsSync(currentResourceFile.dir)) {
                const files = fs.readdirSync(currentResourceFile.dir);
                for (const file of files) {
                    fs.unlinkSync(path.join(currentResourceFile.dir, file));
                }
                fs.rmdirSync(currentResourceFile.dir);
            }
        } catch (e) {
            console.error("Error cleaning up:", e);
        }
        currentResourceFile = null;
    }
}

// دالة توليد وتشغيل الصوت
async function generateAndPlayTTS(rawText) {
    let text = convertFranco(rawText); // تحويل الفرانكو أولاً
    text = addSmartPunctuation(text);  // إضافة الترقيم الذكي عشان الطلاقة
    
    const tts = new MsEdgeTTS();
    await tts.setMetadata('ar-EG-SalmaNeural', OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
    
    const reqId = `tts-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const reqDir = path.join(ttsDir, reqId);
    fs.mkdirSync(reqDir);
    
    try {
        const filePath = path.join(reqDir, 'output.webm');
        const result = await tts.toFile(reqDir, text);
        const actualFilePath = result.audioFilePath || filePath; 
        
        currentResourceFile = { file: actualFilePath, dir: reqDir };
        
        const port = process.env.PORT || 3000;
        const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
        const fileName = path.basename(actualFilePath);
        const playUrl = `${host}/tts/${reqId}/${fileName}`;
        
        const node = shoukaku.options.nodeResolver(shoukaku.nodes);
        const resolveResult = await node.rest.resolve(playUrl);
        
        if (resolveResult && resolveResult.loadType === 'track') {
            await voicePlayer.playTrack({ track: { encoded: resolveResult.data.encoded } });
        } else {
            console.error("Lavalink failed to resolve TTS:", playUrl, resolveResult);
            processNextInQueue();
        }
    } catch (error) {
        console.error("TTS Error:", error);
        processNextInQueue(); // في حالة خطأ، ننتقل للي بعده
    } finally {
        tts.close();
    }
}

async function playMusic(item) {
    try {
        await voicePlayer.playTrack({ track: { encoded: item.trackEncoded } });
        item.message.channel.send(`🎶 جاري تشغيل: **${item.title}**`);
    } catch (error) {
        console.error("Music Error:", error.message);
        item.message.channel.send(`❌ مقدرتش أشغل الأغنية دي: ${error.message.substring(0, 300)}`);
        processNextInQueue();
    }
}

function processNextInQueue() {
    if (queue.length === 0) {
        isPlaying = false;
        currentPlaybackType = null;
        return;
    }
    
    isPlaying = true;
    const item = queue.shift();
    currentPlaybackType = item.type;
    
    if (item.type === 'tts') {
        generateAndPlayTTS(item.text); 
    } else if (item.type === 'music') {
        playMusic(item);
    }
}

// التعامل مع السلاش كوماند
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (BLACKLIST.includes(interaction.user.id)) {
        return interaction.reply({ content: 'أنت في البلاك ليست وممنوع من استخدام البوت!', ephemeral: true });
    }

    if (interaction.commandName === 'punish') {
        const user = interaction.options.getUser('user');
        const newName = interaction.options.getString('new_name');
        const reason = interaction.options.getString('reason');

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'مش قادر ألاقي العضو ده في السيرفر!', ephemeral: true });
        }

        const decisionNumber = Math.floor(Math.random() * 1000) + 1;
        const roleId = '1144243984949055538';

        let nameChanged = true;
        let roleAdded = true;

        // حفظ البيانات القديمة (الاسم والرولات اللي يقدر يسحبها)
        const oldName = member.nickname;
        const oldRoles = member.roles.cache
            .filter(r => r.id !== interaction.guild.id && !r.managed)
            .map(r => r.id);

        // سحب كل الرولات
        try {
            if (oldRoles.length > 0) {
                await member.roles.remove(oldRoles);
            }
        } catch(e) {
            console.error("Couldn't remove old roles", e.message);
        }

        // نحاول ندي الرول
        try {
            await member.roles.add(roleId);
        } catch (error) {
            console.error("Couldn't add role:", error.message);
            roleAdded = false;
        }
        
        // نحاول نغير الاسم لوحده
        try {
            await member.setNickname(newName);
        } catch (error) {
            console.error("Couldn't change nickname:", error.message);
            nameChanged = false;
        }

        // تسجيل العقوبة في الملف لمدة 24 ساعة
        const data = loadPunishments();
        if (!data[interaction.guild.id]) data[interaction.guild.id] = {};
        data[interaction.guild.id][member.id] = {
            oldName: oldName,
            oldRoles: oldRoles,
            unpunishAt: Date.now() + (24 * 60 * 60 * 1000)
        };
        savePunishments(data);
            
        // الرسالة الرسمية بتنزل عادي في كل الحالات
        const officialMessage = `
**🚨 مكافحة البضان والجيل المخصي 🚨**
__بناءً على الصلاحيات الممنوحة لنا، ولأن المحتوى الرقمي الحالي وصل لمرحلة لا يمكن السكوت عليها، تقرر الآتي:__

قرار رقم ${decisionNumber}# 

عزل المخصي : <@${member.id}> **و تم تغير اسمه ل ${newName} + رول البيضة**

السبب : ${reason}

**يُنفذ القرار فوراً ويُضرب بيد من حديد على كل من سولت له نفسه الاستظراف و الاستخفاف ببيضنا.**

**الله , الوطـــن , السلــحــفــاء.**

** معا نحو مستقبل أقل بيض #**
** بضاني مش لعبة #**

||@everyone||`;

        // رسالة التنبيه للشخص اللي استخدم الكوماند
        let replyText = 'تم تنفيذ القرار ونزول البيان!';
        if (!nameChanged) {
            replyText += '\n⚠️ **تنبيه:** مقدرتش أغير اسم الشخص لأن رتبته أعلى مني!';
        }
        if (!roleAdded) {
            replyText += '\n⚠️ **تنبيه:** مقدرتش أديله الرول لأن رتبته أعلى مني!';
        }

        try {
            await interaction.reply({ content: replyText, ephemeral: true });
            await interaction.channel.send(officialMessage);
        } catch (error) {
            console.error("Couldn't send messages:", error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'حصلت مشكلة وأنا ببعت رسالة البيان!', ephemeral: true });
            }
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // لو المستخدم في البلاك ليست، نتجاهله تماماً
    if (BLACKLIST.includes(message.author.id)) return;

    // كوماند دخول الروم
    if (message.content === '!join') {
        if (message.member.voice.channel) {
            let isNewPlayer = false;
            if (!voicePlayer) {
                isNewPlayer = true;
            }
            
            voicePlayer = await shoukaku.joinVoiceChannel({
                guildId: message.guild.id,
                channelId: message.member.voice.channel.id,
                shardId: 0
            });
            
            if (isNewPlayer) {
                voicePlayer.on('end', (data) => {
                    if (data.reason === 'finished' || data.reason === 'stopped') {
                        cleanupCurrentResourceFile();
                        isPlaying = false;
                        processNextInQueue();
                    }
                });
                voicePlayer.on('exception', (error) => {
                    console.error("Lavalink Player Exception:", error);
                    cleanupCurrentResourceFile();
                    isPlaying = false;
                    processNextInQueue();
                });
                voicePlayer.on('stuck', () => {
                    console.warn("Lavalink Player Stuck");
                    cleanupCurrentResourceFile();
                    isPlaying = false;
                    processNextInQueue();
                });
            }
            
            message.reply('دخلت الروم الصوتي! 🎤');
            
            queue.push({ type: 'tts', text: "السَلامُ عَلَيْكُمْ" });
            if (!isPlaying) {
                processNextInQueue();
            }
        } else {
            message.reply('لازم تدخل روم صوتي الأول!');
        }
    }

    // كوماند الكلام
    if (message.content.startsWith('!say ')) {
        if (!voicePlayer) {
            return message.reply('لازم تدخلني الروم الأول باستخدام كوماند !join');
        }

        const botVoiceChannelId = voicePlayer.connection.channelId;
        const memberVoiceChannelId = message.member.voice.channelId;

        if (botVoiceChannelId !== memberVoiceChannelId) {
            return message.reply('عشان تخليني أتكلم لازم تكون معايا في نفس الروم الصوتي!');
        }

        const text = message.content.slice(5);
        message.react('🗣️');
        
        // نظام المقاطعة: وقف الأغاني وشغل الكلام
        queue = queue.filter(item => item.type === 'tts');
        queue.push({ type: 'tts', text });
        
        if (currentPlaybackType === 'music') {
            await voicePlayer.stopTrack(); 
        } else if (!isPlaying) {
            processNextInQueue();
        }
    }

    // كوماند الأغاني
    if (message.content.startsWith('!play ')) {
        if (!message.member.voice.channel) {
            return message.reply('لازم تدخل روم صوتي الأول!');
        }
        
        let isNewPlayer = false;
        if (!voicePlayer) {
            isNewPlayer = true;
        }
        
        voicePlayer = await shoukaku.joinVoiceChannel({
            guildId: message.guild.id,
            channelId: message.member.voice.channel.id,
            shardId: 0
        });
        
        if (isNewPlayer) {
            voicePlayer.on('end', (data) => {
                if (data.reason === 'finished' || data.reason === 'stopped') {
                    cleanupCurrentResourceFile();
                    isPlaying = false;
                    processNextInQueue();
                }
            });
            voicePlayer.on('exception', (error) => {
                console.error("Lavalink Player Exception:", error);
                cleanupCurrentResourceFile();
                isPlaying = false;
                processNextInQueue();
            });
            voicePlayer.on('stuck', () => {
                console.warn("Lavalink Player Stuck");
                cleanupCurrentResourceFile();
                isPlaying = false;
                processNextInQueue();
            });
        }

        const rawQuery = message.content.slice(6).trim();
        if (!rawQuery) return message.reply('اكتب اسم الأغنية أو الرابط بعد الكوماند!');
        
        message.react('🔍');
        
        try {
            const node = shoukaku.options.nodeResolver(shoukaku.nodes);
            const isUrl = rawQuery.startsWith('http');
            const searchString = isUrl ? rawQuery : `ytsearch:${rawQuery}`;
            const result = await node.rest.resolve(searchString);
            
            if (!result || result.loadType === 'empty' || result.loadType === 'error') {
                return message.reply('معرفتش ألاقي الأغنية دي!');
            }
            
            let track;
            if (result.loadType === 'track') {
                track = result.data;
            } else if (result.loadType === 'search') {
                track = result.data[0];
            } else if (result.loadType === 'playlist') {
                track = result.data.tracks[0];
            }
            
            if (!track) {
                return message.reply('معرفتش ألاقي الأغنية دي!');
            }
            
            queue.push({
                type: 'music',
                url: track.info.uri || rawQuery,
                title: track.info.title,
                trackEncoded: track.encoded,
                message: { channel: message.channel }
            });
            
            message.reply(`✅ تم إضافة **${track.info.title}** للطابور!`);
            if (!isPlaying) {
                processNextInQueue();
            }
        } catch (err) {
            console.error("Play error:", err);
            message.reply(`❌ حصلت مشكلة وأنا بدور على الأغنية: ${err.message.substring(0, 300)}`);
        }
    }

    // كوماند تخطي الأغنية
    if (message.content === '!skip') {
        if (!voicePlayer) return;
        if (currentPlaybackType !== 'music') return message.reply('مفيش أغنية شغالة عشان أتخطاها!');
        
        message.reply('⏭️ تم التخطي!');
        await voicePlayer.stopTrack();
    }
    
    // كوماند الإيقاف
    if (message.content === '!stop') {
        if (!voicePlayer) return;
        
        const botVoiceChannelId = voicePlayer.connection.channelId;
        const memberVoiceChannelId = message.member.voice.channelId;

        if (botVoiceChannelId !== memberVoiceChannelId) {
            return message.reply('عشان توقفني لازم تكون معايا في نفس الروم الصوتي!');
        }

        queue = [];
        await voicePlayer.stopTrack();
        message.react('🛑');
        message.reply('سكت خلاص ومسحت كل الأغاني والكلام اللي في الطابور!');
    }

    // كوماند الخروج
    if (message.content === '!leave') {
        if (voicePlayer) {
            queue = [];
            await voicePlayer.stopTrack();
            await shoukaku.leaveVoiceChannel(message.guild.id);
            voicePlayer = null;
            message.reply('خرجت من الروم الصوتي! 👋');
        } else {
            message.reply('أنا مش في روم صوتي أصلاً!');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
