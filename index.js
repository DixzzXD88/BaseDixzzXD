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

    if (!dixzz.authState.creds.registered) {
        console.log("\x1b[32m1. Pairing Code\n2. Scan QR\x1b[0m")
        const opsi = await question("Pilih (1/2): ")
        if (opsi === '1') {
            const phoneNumber = await question('\nNomor WA (628xxx): ')
            await sleep(3000) 
            try {
                const code = await dixzz.requestPairingCode(phoneNumber.trim())
                console.log(`\n\x1b[36mKODE PAIRING LO:\x1b[0m \x1b[1;31m${code}\x1b[0m\n`)
            } catch (err) {
                console.log("Gagal dapet kode, coba scan QR di atas aja.")
            }
        }
    }

    dixzz.ev.on('creds.update', saveCreds)
    dixzz.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) startBot()
        } else if (connection === 'open') {
            console.log('\x1b[32m✅ ONLINE & ANTI-SPAM ACTIVE!\x1b[0m\n')
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
