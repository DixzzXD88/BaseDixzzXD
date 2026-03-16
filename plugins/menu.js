const fs = require('fs')

module.exports = {
    run: async (dixzz, m, { from, config, pushname }) => {
        try {
            // 1. EFEK CENTANG BIRU (Read Message)
            await dixzz.readMessages([m.key])

            // 2. DATA MENU
            const pluginFiles = fs.readdirSync('./plugins').filter(file => file.endsWith('.js'))
            const listMenu = pluginFiles.map(file => `│ ◦ .${file.replace('.js', '')}`).join('\n')

            const menuTeks = `╭───「 *${config.botName}* 」───
│
│ 👋 *Halo, ${pushname}!*
│ 👑 *Owner:* @${config.ownerNumber}
│
├─「 *DAFTAR FITUR* 」
${listMenu}
│
╰──────────────────────────`

            // 3. SEND MENU DENGAN FAKE QUOTED WHATSAPP VERIFIED
            await dixzz.sendMessage(from, { 
                text: menuTeks,
                contextInfo: {
                    mentionedJid: [config.ownerNumber + '@s.whatsapp.net'],
                    // INI RAHASIA FAKE QUOTED VERIFIED-NYA:
                    quotedMessage: {
                        conversation: "WhatsApp Official System: Menu Requested."
                    },
                    remoteJid: "0@s.whatsapp.net", // ID WhatsApp Official
                    participant: "0@s.whatsapp.net" // ID WhatsApp Official
                }
            }, { quoted: m })

        } catch (e) {
            console.error("Error Menu:", e)
        }
    }
}
