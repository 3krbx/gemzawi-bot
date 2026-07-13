const { Client, GatewayIntentBits, ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Shoukaku, Connectors } = require('shoukaku');
require('dotenv').config();

const db = require('./database');
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

shoukaku.on('error', (name, error) => {
    const err = error || name;
    console.error(`Shoukaku Error:`, err?.message || err);
});
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} connected!`));
shoukaku.on('disconnect', (name) => console.log(`Lavalink Node ${name} disconnected`));

const serversData = new Map();

function getServerData(guildId) {
    if (!serversData.has(guildId)) {
        serversData.set(guildId, {
            voicePlayer: null,
            queue: [],
            isPlaying: false,
            currentResourceFile: null,
            currentPlaybackType: null
        });
    }
    return serversData.get(guildId);
}

async function safeJoinVoiceChannel(message) {
    const guildId = message.guild.id;
    const server = getServerData(guildId);

    // If the bot is already in the same channel and we have a player, just return it
    const botMem = message.guild.members.me;
    if (server.voicePlayer && botMem && botMem.voice.channelId === message.member.voice.channel.id) {
        return server.voicePlayer;
    }

    try {
        // If moving to a different channel or not connected
        return await shoukaku.joinVoiceChannel({
            guildId: guildId,
            channelId: message.member.voice.channel.id,
            shardId: 0
        });
    } catch (error) {
        if (error.message && error.message.includes("existing connection")) {
            console.log(`Connection exists for ${guildId}, leaving and rejoining...`);
            try {
                await shoukaku.leaveVoiceChannel(guildId);
                await new Promise(r => setTimeout(r, 1000));
                return await shoukaku.joinVoiceChannel({
                    guildId: guildId,
                    channelId: message.member.voice.channel.id,
                    shardId: 0
                });
            } catch (retryError) {
                console.error("Failed to rejoin after leaving:", retryError);
                return null;
            }
        }
        console.error("Failed to join voice channel:", error);
        return null;
    }
}

// قائمة البلاك ليست (الأيديهات الممنوعة من استخدام البوت)
const BLACKLIST = [];

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await db.initDB();
    
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
                },
                {
                    name: 'duration_hours',
                    type: ApplicationCommandOptionType.Integer,
                    description: 'مدة العقاب بالساعات',
                    required: true,
                }
            ]
        },
        {
            name: 'court',
            description: 'بدء جلسة محكمة طارئة وسحب الجميع للمنصة',
            options: [
                {
                    name: 'judge',
                    type: ApplicationCommandOptionType.User,
                    description: 'القاضي',
                    required: true,
                },
                {
                    name: 'accused',
                    type: ApplicationCommandOptionType.User,
                    description: 'المتهم',
                    required: true,
                },
                {
                    name: 'lawyer',
                    type: ApplicationCommandOptionType.User,
                    description: 'المحامي',
                    required: true,
                }
            ]
        },
        {
            name: 'endcourt',
            description: 'إنهاء جلسة المحكمة وإرجاع الأسماء وحذف الروم',
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
        const punishments = await db.getPunishments();
        const now = Date.now();

        for (const punishInfo of punishments) {
            if (now >= punishInfo.unpunish_at) {
                try {
                    const guild = await client.guilds.fetch(punishInfo.guild_id).catch(()=>null);
                    if (guild) {
                        const member = await guild.members.fetch(punishInfo.user_id).catch(()=>null);
                        if (member) {
                            // سحب رول العقاب
                            const roleId = '1144243984949055538';
                            await member.roles.remove(roleId).catch(()=>{});
                            // استرجاع الرولات القديمة
                            const oldRoles = JSON.parse(punishInfo.old_roles);
                            if (oldRoles && oldRoles.length > 0) {
                                for (const rId of oldRoles) {
                                    await member.roles.add(rId).catch(()=>{});
                                }
                            }
                            // استرجاع الاسم
                            await member.setNickname(punishInfo.old_name).catch(()=>{});
                        }
                    }
                } catch (e) {
                    console.error("Error restoring user", e);
                }
                
                await db.removePunishment(punishInfo.guild_id, punishInfo.user_id);
            }
        }
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

// تشكيل الكلمات العامية عشان الذكاء الاصطناعي ينطقها مصري صح بدل الفصحى
function egyptianizeText(text) {
    const slangMap = {
        'يعم': 'يا عَم',
        'ياعم': 'يا عَم',
        'عشان': 'عَشان',
        'علشان': 'عَلَشان',
        'ليه': 'لِيه',
        'ايه': 'إِيه',
        'إيه': 'إِيه',
        'مين': 'مِين',
        'بقولك': 'بَقُولَّك',
        'ازاي': 'إِزَّاي',
        'إزاي': 'إِزَّاي',
        'كده': 'كِدَه',
        'كدا': 'كِدَا',
        'دي': 'دِي',
        'ده': 'دَه',
        'دا': 'دَا',
        'بجد': 'بِجَد',
        'طب': 'طَب',
        'طيب': 'طَيِّب',
        'اومال': 'أُمَّال',
        'فين': 'فِين',
        'بكام': 'بِكَام',
        'لول': 'لُول',
        'يسطا': 'يَاسْطَا',
        'ياسطا': 'يَاسْطَا',
        'يعني': 'يَعْنِي',
        'امتى': 'إِمْتَى',
        'إمتى': 'إِمْتَى',
        'بتاع': 'بِتَاع'
    };

    for (const [slang, correct] of Object.entries(slangMap)) {
        const regex = new RegExp(`(^|\\s)${slang}(\\s|$)`, 'g');
        text = text.replace(regex, `$1${correct}$2`);
    }
    
    return text;
}

function cleanupCurrentResourceFile(guildId) {
    const server = getServerData(guildId);
    if (server.currentResourceFile) {
        try {
            if (fs.existsSync(server.currentResourceFile.file)) fs.unlinkSync(server.currentResourceFile.file);
            if (server.currentResourceFile.dir && fs.existsSync(server.currentResourceFile.dir)) {
                const files = fs.readdirSync(server.currentResourceFile.dir);
                for (const file of files) {
                    fs.unlinkSync(path.join(server.currentResourceFile.dir, file));
                }
                fs.rmdirSync(server.currentResourceFile.dir);
            }
        } catch (e) {
            console.error("Error cleaning up:", e);
        }
        server.currentResourceFile = null;
    }
}

// دالة توليد وتشغيل الصوت
async function generateAndPlayTTS(guildId, rawText) {
    const server = getServerData(guildId);
    let text = rawText; // تم إلغاء تحويل الفرانكو ليقرأ البوت الحروف الإنجليزية بنطقها السليم
    text = addSmartPunctuation(text);  // إضافة الترقيم الذكي عشان الطلاقة
    text = egyptianizeText(text); // تشكيل الكلمات باللهجة المصرية
    text = "، " + text; // إضافة فترة صمت قصيرة في البداية لتجنب قطع أول حرف
    
    const tts = new MsEdgeTTS();
    await tts.setMetadata('ar-EG-SalmaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    
    const reqId = `tts-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const reqDir = path.join(ttsDir, reqId);
    fs.mkdirSync(reqDir);
    
    try {
        const filePath = path.join(reqDir, 'output.mp3');
        const result = await tts.toFile(reqDir, text);
        const actualFilePath = result.audioFilePath || filePath; 
        
        server.currentResourceFile = { file: actualFilePath, dir: reqDir };
        
        const port = process.env.PORT || 3000;
        const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
        const fileName = path.basename(actualFilePath);
        const playUrl = `${host}/tts/${reqId}/${fileName}`;
        
        const node = shoukaku.options.nodeResolver(shoukaku.nodes);
        let resolveResult = null;
        
        try {
            resolveResult = await node.rest.resolve(playUrl);
        } catch (resolveError) {
            console.error("Lavalink failed to resolve local TTS, triggering fallback...");
        }
        
        // لو فشل في جلب الملف المحلي (مثلاً لو شغالين لوكال أو الاستضافة بطيئة)، هنحول تلقائياً لـ Google TTS
        if (!resolveResult || resolveResult.loadType !== 'track') {
            console.log("Local TTS resolve failed, falling back to Google Translate TTS...");
            const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ar&client=tw-ob`;
            try {
                resolveResult = await node.rest.resolve(googleTtsUrl);
            } catch (googleError) {
                console.error("Google TTS fallback also failed to resolve.");
            }
        }
        
        if (resolveResult && resolveResult.loadType === 'track') {
            await server.voicePlayer.playTrack({ track: { encoded: resolveResult.data.encoded } });
        } else {
            console.error("Lavalink failed to resolve TTS:", playUrl, resolveResult);
            processNextInQueue(guildId);
        }
    } catch (error) {
        console.error("TTS Error:", error);
        processNextInQueue(guildId); // في حالة خطأ، ننتقل للي بعده
    } finally {
        tts.close();
    }
}

async function playMusic(guildId, item) {
    const server = getServerData(guildId);
    try {
        await server.voicePlayer.playTrack({ track: { encoded: item.trackEncoded } });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_pause_resume')
                    .setLabel('⏸️ تشغيل/إيقاف مؤقت')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setLabel('⏭️ تخطي')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setLabel('🛑 إيقاف')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('music_queue')
                    .setLabel('📜 الطابور')
                    .setStyle(ButtonStyle.Success)
            );
            
        await item.message.channel.send({
            content: `🎶 جاري تشغيل: **${item.title}**`,
            components: [row]
        });
    } catch (error) {
        console.error("Music Error:", error.message);
        item.message.channel.send(`❌ مقدرتش أشغل الأغنية دي: ${error.message.substring(0, 300)}`);
        processNextInQueue(guildId);
    }
}

function processNextInQueue(guildId) {
    const server = getServerData(guildId);
    if (server.queue.length === 0) {
        server.isPlaying = false;
        server.currentPlaybackType = null;
        return;
    }
    
    server.isPlaying = true;
    const item = server.queue.shift();
    server.currentPlaybackType = item.type;
    
    if (item.type === 'tts') {
        generateAndPlayTTS(guildId, item.text); 
    } else if (item.type === 'music') {
        playMusic(guildId, item);
    }
}

// التعامل مع السلاش كوماند والكونترول بانل
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const guildId = interaction.guild.id;
        const server = getServerData(guildId);

        if (interaction.customId.startsWith('music_')) {
            if (!interaction.member.voice.channel) {
                return interaction.reply({ content: 'لازم تكون في روم صوتي الأول عشان تتحكم!', ephemeral: true });
            }
            
            if (!server.voicePlayer) {
                return interaction.reply({ content: 'البوت مش في روم صوتي أصلاً!', ephemeral: true });
            }
            
            const botVoiceChannelId = interaction.guild.members.me?.voice?.channelId;
            const memberVoiceChannelId = interaction.member.voice?.channelId;
            if (!botVoiceChannelId || botVoiceChannelId !== memberVoiceChannelId) {
                return interaction.reply({ content: 'لازم تكون معايا في نفس الروم الصوتي عشان تتحكم!', ephemeral: true });
            }
            
            if (interaction.customId === 'music_pause_resume') {
                const isPaused = server.voicePlayer.paused;
                await server.voicePlayer.pause(!isPaused);
                return interaction.reply({ content: isPaused ? '▶️ تم الاستئناف!' : '⏸️ تم الإيقاف المؤقت!', ephemeral: true });
            }
            
            if (interaction.customId === 'music_skip') {
                if (server.currentPlaybackType !== 'music') {
                    return interaction.reply({ content: 'مفيش أغنية شغالة حالياً لتخطيها!', ephemeral: true });
                }
                await server.voicePlayer.stopTrack();
                return interaction.reply({ content: '⏭️ تم تخطي الأغنية!', ephemeral: true });
            }
            
            if (interaction.customId === 'music_stop') {
                server.queue = [];
                server.isPlaying = false;
                server.currentPlaybackType = null;
                await server.voicePlayer.stopTrack();
                return interaction.reply({ content: '🛑 تم إيقاف التشغيل ومسح الطابور!', ephemeral: true });
            }
            
            if (interaction.customId === 'music_queue') {
                if (server.queue.length === 0) {
                    return interaction.reply({ content: 'الطابور فارغ حالياً!', ephemeral: true });
                }
                const queueList = server.queue.map((item, idx) => `${idx + 1}. **${item.title || 'كلام (TTS)'}**`).join('\n');
                return interaction.reply({ content: `📜 **طابور التشغيل:**\n${queueList.substring(0, 1900)}`, ephemeral: true });
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (BLACKLIST.includes(interaction.user.id)) {
        return interaction.reply({ content: 'أنت في البلاك ليست وممنوع من استخدام البوت!', ephemeral: true });
    }

    if (interaction.commandName === 'punish') {
        await interaction.deferReply({ ephemeral: true });
        
        const user = interaction.options.getUser('user');
        const newName = interaction.options.getString('new_name');
        const reason = interaction.options.getString('reason');
        const durationHours = interaction.options.getInteger('duration_hours');

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

        // تسجيل العقوبة في قاعدة البيانات
        await db.addPunishment(interaction.guild.id, member.id, oldName, oldRoles, Date.now() + (durationHours * 60 * 60 * 1000));
            
        // الرسالة الرسمية بتنزل عادي في كل الحالات
        const officialMessage = `
**🚨 مكافحة البضان والجيل المخصي 🚨**
__بناءً على الصلاحيات الممنوحة لنا، ولأن المحتوى الرقمي الحالي وصل لمرحلة لا يمكن السكوت عليها، تقرر الآتي:__

قرار رقم ${decisionNumber}# 

عزل المخصي : <@${member.id}> **و تم تغير اسمه ل ${newName} + رول البيضة**

السبب : ${reason}
المدة : ${durationHours} ساعة

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
            await interaction.editReply({ content: replyText });
            await interaction.channel.send(officialMessage);
        } catch (error) {
            console.error("Couldn't send messages:", error);
            try {
                await interaction.editReply({ content: 'حصلت مشكلة وأنا ببعت رسالة البيان!' });
            } catch (e) {}
        }
    }

    if (interaction.commandName === 'court') {
        await interaction.deferReply();
        const judge = interaction.options.getUser('judge');
        const accused = interaction.options.getUser('accused');
        const lawyer = interaction.options.getUser('lawyer');

        const guild = interaction.guild;
        const callerMember = interaction.member;
        
        if (!callerMember.permissions.has('ManageChannels')) {
            return interaction.editReply('ليس لديك صلاحيات لفتح قاعة المحكمة!');
        }

        const stageChannel = await guild.channels.create({
            name: '⚖️ المحكمة الطارئة',
            type: 13, // Stage Channel
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    allow: ['Connect', 'ViewChannel'],
                    deny: ['Speak', 'RequestToSpeak']
                },
                {
                    id: client.user.id,
                    allow: ['Connect', 'ViewChannel', 'Speak', 'ManageChannels', 'MuteMembers', 'MoveMembers', 'ManageRoles']
                },
                {
                    id: callerMember.id,
                    allow: ['Connect', 'ViewChannel', 'Speak', 'ManageChannels', 'MuteMembers', 'MoveMembers', 'ManageRoles']
                },
                {
                    id: judge.id,
                    allow: ['Connect', 'ViewChannel', 'Speak', 'ManageChannels', 'MuteMembers', 'MoveMembers', 'ManageRoles']
                }
            ]
        });

        // إنشاء جلسة بث للمنصة لكي نتمكن من رفع المتحدثين
        try {
            await guild.stageInstances.create({
                channel: stageChannel.id,
                topic: '⚖️ المحكمة الطارئة'
            });
        } catch (err) {
            console.error("Error creating stage instance:", err);
            // الانتظار ثانية والمحاولة مرة أخرى
            await new Promise(r => setTimeout(r, 1000));
            await guild.stageInstances.create({
                channel: stageChannel.id,
                topic: '⚖️ المحكمة الطارئة'
            }).catch(e => console.error("Retry failed:", e));
        }

        const accusedMember = await guild.members.fetch(accused.id).catch(() => null);
        const lawyerMember = await guild.members.fetch(lawyer.id).catch(() => null);
        const judgeMember = await guild.members.fetch(judge.id).catch(() => null);

        const accusedOldName = accusedMember ? accusedMember.nickname : null;
        const lawyerOldName = lawyerMember ? lawyerMember.nickname : null;
        const judgeOldName = judgeMember ? judgeMember.nickname : null;

        await db.saveCourtSession(guild.id, stageChannel.id, accused.id, lawyer.id, accusedOldName, lawyerOldName, judge.id, judgeOldName);

        if (accusedMember) await accusedMember.setNickname(`[المتهم] ${accusedMember.user.username}`).catch(()=>{});
        if (lawyerMember) await lawyerMember.setNickname(`[المحامي] ${lawyerMember.user.username}`).catch(()=>{});
        if (judgeMember) await judgeMember.setNickname(`[القاضي] ${judgeMember.user.username}`).catch(()=>{});

        let movedCount = 0;
        const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased() && c.id !== stageChannel.id);
        for (const [id, vc] of voiceChannels) {
            for (const [mId, member] of vc.members) {
                await member.voice.setChannel(stageChannel).catch(()=>{});
                movedCount++;
            }
        }

        // انضمام البوت
        voicePlayer = await safeJoinVoiceChannel({
            guild: guild,
            member: { voice: { channel: stageChannel } }
        });
        
        // دالة لرفع العضو كمتحدث مع المحاولة عدة مرات حتى تنجح (لأن الديسكورد يأخذ وقت لاستيعاب النقل)
        const makeSpeaker = (memberId) => {
            let attempts = 0;
            const interval = setInterval(async () => {
                attempts++;
                const mem = await guild.members.fetch(memberId).catch(() => null);
                if (mem && mem.voice.channelId === stageChannel.id) {
                    try {
                        await mem.voice.setSuppressed(false);
                        clearInterval(interval);
                    } catch (e) {
                        // ignore
                    }
                }
                if (attempts > 15) clearInterval(interval); // استسلام بعد 15 ثانية
            }, 1000);
        };

        makeSpeaker(client.user.id);
        makeSpeaker(judge.id);
        makeSpeaker(callerMember.id);

        // تحدث البوت بكلمة محكمة بعد 3 ثواني
        setTimeout(() => {
            if (voicePlayer) {
                queue.push({ type: 'tts', text: 'مَحْكَمَة!' });
                if (!isPlaying) processNextInQueue();
            }
        }, 3000);

        return interaction.editReply(`⚖️ تم فتح قاعة المحكمة <#${stageChannel.id}>!\nتم سحب ${movedCount} عضو للجمهور.`);
    }

    if (interaction.commandName === 'endcourt') {
        await interaction.deferReply();
        const callerMember = interaction.member;
        
        if (!callerMember.permissions.has('ManageChannels')) {
            return interaction.editReply('ليس لديك صلاحيات لإنهاء قاعة المحكمة!');
        }

        const sessions = await db.getGuildCourtSessions(interaction.guild.id);
        if (!sessions || sessions.length === 0) {
            return interaction.editReply('لا توجد جلسات محكمة مفتوحة حالياً!');
        }

        let closedCount = 0;
        for (const session of sessions) {
            const channel = interaction.guild.channels.cache.get(session.stage_channel_id);
            if (channel) await channel.delete().catch(()=>{});

            const accusedMember = await interaction.guild.members.fetch(session.accused_id).catch(()=>null);
            const lawyerMember = await interaction.guild.members.fetch(session.lawyer_id).catch(()=>null);
            const judgeMember = session.judge_id ? await interaction.guild.members.fetch(session.judge_id).catch(()=>null) : null;

            if (accusedMember) await accusedMember.setNickname(session.accused_old_name).catch(()=>{});
            if (lawyerMember) await lawyerMember.setNickname(session.lawyer_old_name).catch(()=>{});
            if (judgeMember) await judgeMember.setNickname(session.judge_old_name).catch(()=>{});

            await db.removeCourtSession(session.guild_id, session.stage_channel_id);
            closedCount++;
        }

        return interaction.editReply(`تم إغلاق ${closedCount} جلسة محكمة وإرجاع الأسماء القديمة!`);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // لو المستخدم في البلاك ليست، نتجاهله تماماً
    if (BLACKLIST.includes(message.author.id)) return;

    const guildId = message.guild.id;
    const server = getServerData(guildId);

    // كوماند دخول الروم
    if (message.content === '!join') {
        if (message.member.voice.channel) {
            let isNewPlayer = false;
            
            // تحقق لو البوت موجود أصلاً في نفس الروم
            const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
            if (server.voicePlayer && botVoiceChannelId === message.member.voice.channel.id) {
                return message.reply('أنا معاك في الروم بالفعل! 🎤');
            }

            if (!server.voicePlayer) {
                isNewPlayer = true;
            }
            
            server.voicePlayer = await safeJoinVoiceChannel(message);
            if (!server.voicePlayer) {
                return message.reply('❌ حصلت مشكلة وأنا بحاول أدخل الروم! (ممكن سيرفر الصوت فيه مشكلة)');
            }
            
            if (isNewPlayer) {
                server.voicePlayer.on('end', (data) => {
                    if (data.reason === 'finished' || data.reason === 'stopped') {
                        cleanupCurrentResourceFile(guildId);
                        server.isPlaying = false;
                        processNextInQueue(guildId);
                    }
                });
                server.voicePlayer.on('exception', (error) => {
                    console.error("Lavalink Player Exception:", error);
                    cleanupCurrentResourceFile(guildId);
                    server.isPlaying = false;
                    processNextInQueue(guildId);
                });
                server.voicePlayer.on('stuck', () => {
                    console.warn("Lavalink Player Stuck");
                    cleanupCurrentResourceFile(guildId);
                    server.isPlaying = false;
                    processNextInQueue(guildId);
                });
            }
            
            message.reply('دخلت الروم الصوتي! 🎤');
            
            server.queue.push({ type: 'tts', text: "السَلامُ عَلَيْكُمْ" });
            if (!server.isPlaying) {
                processNextInQueue(guildId);
            }
        } else {
            message.reply('لازم تدخل روم صوتي الأول!');
        }
    }

    // كوماند الكلام
    if (message.content.startsWith('!say ')) {
        if (!server.voicePlayer) {
            return message.reply('لازم تدخلني الروم الأول باستخدام كوماند !join');
        }

        const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
        const memberVoiceChannelId = message.member.voice?.channelId;

        if (!botVoiceChannelId || botVoiceChannelId !== memberVoiceChannelId) {
            return message.reply('عشان تخليني أتكلم لازم تكون معايا في نفس الروم الصوتي!');
        }

        const text = message.content.slice(5);
        message.react('🗣️').catch(()=>{});
        
        // نظام المقاطعة: وقف الأغاني وشغل الكلام
        server.queue = server.queue.filter(item => item.type === 'tts');
        server.queue.push({ type: 'tts', text });
        
        if (server.currentPlaybackType === 'music') {
            await server.voicePlayer.stopTrack(); 
        } else if (!server.isPlaying) {
            processNextInQueue(guildId);
        } else if (server.voicePlayer && !server.voicePlayer.track) {
            // حالة التعليق: لو البوت بيقول إنه شغال بس مفيش تراك بيتلعب فعلياً
            server.isPlaying = false;
            processNextInQueue(guildId);
        }
    }

    // كوماند الأغاني
    if (message.content.startsWith('!play ')) {
        if (!message.member.voice.channel) {
            return message.reply('لازم تدخل روم صوتي الأول!');
        }
        
        let isNewPlayer = false;
        if (!server.voicePlayer) {
            isNewPlayer = true;
        }
        
        server.voicePlayer = await safeJoinVoiceChannel(message);
        if (!server.voicePlayer) {
            return message.reply('❌ حصلت مشكلة وأنا بحاول أدخل الروم! (ممكن سيرفر الصوت فيه مشكلة)');
        }
        
        if (isNewPlayer) {
            server.voicePlayer.on('end', (data) => {
                if (data.reason === 'finished' || data.reason === 'stopped') {
                    cleanupCurrentResourceFile(guildId);
                    server.isPlaying = false;
                    processNextInQueue(guildId);
                }
            });
            server.voicePlayer.on('exception', (error) => {
                console.error("Lavalink Player Exception:", error);
                cleanupCurrentResourceFile(guildId);
                server.isPlaying = false;
                processNextInQueue(guildId);
            });
            server.voicePlayer.on('stuck', () => {
                console.warn("Lavalink Player Stuck");
                cleanupCurrentResourceFile(guildId);
                server.isPlaying = false;
                processNextInQueue(guildId);
            });
        }

        const rawQuery = message.content.slice(6).trim();
        if (!rawQuery) return message.reply('اكتب اسم الأغنية أو الرابط بعد الكوماند!');
        
        message.react('🔍').catch(()=>{});
        
        try {
            // تقسيم الكويري باستخدام الفاصلة العادية والعربية
            const queries = rawQuery.split(/[,\u060C]+/).map(q => q.trim()).filter(Boolean);
            
            if (queries.length === 0) {
                return message.reply('اكتب اسم الأغنية أو الرابط بعد الكوماند!');
            }

            const node = shoukaku.options.nodeResolver(shoukaku.nodes);
            const addedTracks = [];
            
            // حل المسارات والروابط بالتوازي لسرعة فائقة
            const resolvedTracks = await Promise.all(queries.map(async (query) => {
                try {
                    const isUrl = query.startsWith('http');
                    const searchString = isUrl ? query : `ytsearch:${query}`;
                    const result = await node.rest.resolve(searchString);
                    if (!result) return null;
                    
                    let track;
                    if (result.loadType === 'track') {
                        track = result.data;
                    } else if (result.loadType === 'search' && result.data.length > 0) {
                        track = result.data[0];
                    } else if (result.loadType === 'playlist' && result.data.tracks.length > 0) {
                        track = result.data.tracks[0];
                    }
                    return track;
                } catch (e) {
                    console.error("Resolve query error:", query, e.message);
                    return null;
                }
            }));
            
            for (const track of resolvedTracks) {
                if (track) {
                    server.queue.push({
                        type: 'music',
                        url: track.info.uri,
                        title: track.info.title,
                        trackEncoded: track.encoded,
                        message: { channel: message.channel }
                    });
                    addedTracks.push(track.info.title);
                }
            }
            
            if (addedTracks.length === 0) {
                return message.reply('معرفتش ألاقي الأغاني دي!');
            }
            
            if (addedTracks.length === 1) {
                message.reply(`✅ تم إضافة **${addedTracks[0]}** للطابور!`);
            } else {
                message.reply(`✅ تم إضافة **${addedTracks.length} أغنية** للطابور:\n${addedTracks.map((title, idx) => `${idx + 1}. **${title}**`).join('\n')}`);
            }
            
            if (!server.isPlaying) {
                processNextInQueue(guildId);
            }
        } catch (err) {
            console.error("Play error:", err);
            message.reply(`❌ حصلت مشكلة وأنا بدور على الأغنية: ${err.message.substring(0, 300)}`);
        }
    }

    // كوماند تخطي الأغنية
    if (message.content === '!skip') {
        if (!server.voicePlayer) return;
        if (server.currentPlaybackType !== 'music') return message.reply('مفيش أغنية شغالة عشان أتخطاها!');
        
        message.reply('⏭️ تم التخطي!');
        await server.voicePlayer.stopTrack();
    }
    
    // كوماند الإيقاف
    if (message.content === '!stop') {
        if (!server.voicePlayer) return;
        
        const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
        const memberVoiceChannelId = message.member.voice?.channelId;

        if (!botVoiceChannelId || botVoiceChannelId !== memberVoiceChannelId) {
            return message.reply('عشان توقفني لازم تكون معايا في نفس الروم الصوتي!');
        }

        server.queue = [];
        server.isPlaying = false;
        server.currentPlaybackType = null;
        await server.voicePlayer.stopTrack();
        message.react('🛑').catch(()=>{});
        message.reply('سكت خلاص ومسحت كل الأغاني والكلام اللي في الطابور!');
    }

    // كوماند الخروج
    if (message.content === '!leave') {
        if (server.voicePlayer) {
            server.queue = [];
            await server.voicePlayer.stopTrack();
            await shoukaku.leaveVoiceChannel(guildId);
            server.voicePlayer = null;
            message.reply('خرجت من الروم الصوتي! 👋');
        } else {
            message.reply('أنا مش في روم صوتي أصلاً!');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
