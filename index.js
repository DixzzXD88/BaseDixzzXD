const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    jidDecode,
    makeCacheableSignalKeyStore // <-- TAMBAHIN INI
} = require("@whiskeysockets/baileys")
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const { Boom } = require('@hapi/boom')
const readline = require("readline")
const config = require('./config')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function decodeJid(jid) {
    if (!jid) return jid
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {}
        return decode.user && decode.server && decode.user + '@' + decode.server || jid
    } else return jid
}

const cooldowns = new Set()

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName)
    const { version } = await fetchLatestBaileysVersion()

    process.stdout.write('\x1Bc') 
    console.log("\x1b[36m==========================================\x1b[0m")
    console.log("\x1b[33m      DIXZZ BOT SYSTEM - MONITOR ON       \x1b[0m")
    console.log("\x1b[36m==========================================\x1b[0m")
    
    const dixzz = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) // <-- BIAR PAIRING JOSS
        },
        version,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: true // Biar QR tetep muncul buat cadangan
    })

    // --- [ PAIRING SYSTEM ] ---
    if (!dixzz.authState.creds.registered) {
        process.stdout.write('\x1Bc')
        console.log(color.cyan('╔════════════════════════════╗'))
        console.log(color.cyan('║     DIXZZ BOT PAIRING      ║'))
        console.log(color.cyan('╚════════════════════════════╝'))
        console.log(color.green('[ 1 ] Pairing Code'))
        console.log(color.yellow('[ 2 ] Scan QR Code'))
        
        const method = await question(color.white('\n➤ Pilih metode login: '))

        if (method === '1') {
            let num = await question(color.white('➤ Nomor Bot (628xx): '))
            num = num.replace(/[^0-9]/g, '')
            
            console.log(color.yellow('\n⏳ Menghubungkan ke server... Mohon tunggu 3 detik!'))
            await new Promise(r => setTimeout(r, 3000)) 

            try {
                const code = await dixzz.requestPairingCode(num,config.customCode)
                const formattedCode = code.match(/.{1,4}/g).join('-')
                console.log(color.green(`\n✅ KODE PAIRING: `) + color.red(formattedCode))
                console.log(color.cyan(`📱 Cara: Buka WhatsApp > 3 titik > Perangkat tertaut > Pairing`))
            } catch (err) {
                console.log(color.red(`\n❌ Gagal: ${err.message}`))
                console.log(color.yellow(`💡 Hapus folder session lalu coba lagi`))
            }
        } else {
            console.log(color.yellow('\n⏳ Menyiapkan QR Code...'))
            dixzz.ev.on('connection.update', (u) => { 
                if (u.qr) {
                    qrcode.generate(u.qr, { small: true })
                    console.log(color.cyan(`📱 Scan QR di atas dengan WhatsApp`))
                }
            })
        }
    }

    dixzz.ev.on('creds.update', saveCreds)
    
    dixzz.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'open') {
            const botNumber = dixzz.user?.id ? dixzz.user.id.split('@')[0] : 'Unknown'
            console.log(color.green(`╔════════════════════════════════════╗`))
            console.log(color.green(`║         BOT ONLINE!                ║`))
            console.log(color.green(`╠════════════════════════════════════╣`))
            console.log(color.green(`║ 📱 Bot Number : ${botNumber}`))
            console.log(color.green(`║ 🔧 Prefix     : ${config.prefix}`))
            console.log(color.green(`║ 👑 Owner      : ${config.ownerNumber}`))
            console.log(color.green(`╚════════════════════════════════════╝`))
            setTimeout(async () => {
                const saluranTarget = [
                    "120363423847290049@newsletter",
                    "120363404623162218@newsletter"
                ];

                for (const jid of saluranTarget) {
                    try {
                        await dixzz.newsletterFollow(jid);
                    } catch (e) {}
                    await new Promise(r => setTimeout(r, 3000));
                }
            }, 10000);
        } 
            
            // LOOP RECORDING
            setInterval(async () => {
                if (dixzz?.ws?.readyState === 1) {
                    for (let jid of global.recordingTarget) {
                        try {
                            await dixzz.sendPresenceUpdate('recording', jid);
                        } catch {
                            global.recordingTarget.delete(jid);
                        }
                    }
                }
            }, 4000);
        
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) {
                console.log(color.yellow(`\n⚠️ Koneksi terputus, reconnect dalam 5 detik...`))
                setTimeout(() => startDixzz(), 5000)
            } else {
                console.log(color.red(`\n❌ Sesi berakhir. Hapus folder session dan login ulang.`))
                cleanupTmp()
            }
        }
    })


    dixzz.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0]
            if (!m.message || m.key.fromMe) return // Gak ngerespon pesan sendiri
            
            const from = m.key.remoteJid
            const pushname = m.pushName || "User"
            const sender = decodeJid(m.key.participant || m.key.remoteJid)

            const type = Object.keys(m.message)[0]
            let body = (type === 'conversation') ? m.message.conversation : 
                       (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : 
                       (type === 'imageMessage') ? m.message.imageMessage.caption : ''
            
            // Log Monitor
            const time = new Date().toLocaleTimeString()
            console.log(`\x1b[36m[${time}]\x1b[0m \x1b[32m${pushname}\x1b[0m: ${body || type}`)

            if (!body.startsWith(config.prefix)) return 

            if (cooldowns.has(sender)) return 

            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase()
            const args = body.trim().split(/ +/).slice(1)
            
            // Otomatis nambahin @s.whatsapp.net ke owner number di config
            const ownerJid = config.ownerNumber.includes('@') ? config.ownerNumber : config.ownerNumber + '@s.whatsapp.net'

            const pluginFiles = fs.readdirSync('./plugins').filter(file => file.endsWith('.js'))
            for (let file of pluginFiles) {
                // Logic manggil plugin (sticker.js bisa dipanggil .s)
                const isSticker = (command === 's' || command === 'sticker') && file === 'sticker.js'
                const isMatch = file.replace('.js', '') === command

                if (isMatch || isSticker) {
                    try {
                        cooldowns.add(sender)
                        const plugin = require(`./plugins/${file}`)
                        
                        // Kirim data lengkap ke plugin
                        await plugin.run(dixzz, m, { 
                            from, args, sender, decodeJid, sleep, 
                            config: { ...config, ownerNumber: ownerJid }, 
                            body 
                        })
                        
                        delete require.cache[require.resolve(`./plugins/${file}`)]
                        setTimeout(() => cooldowns.delete(sender), config.cooldown)
                    } catch (err) {
                        console.log(`\x1b[31m[ ERROR ]\x1b[0m`, err)
                        cooldowns.delete(sender)
                    }
                }
            }
        } catch (err) { console.log(err) }
    })
}
startBot()
