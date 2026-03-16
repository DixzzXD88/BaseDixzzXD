const { downloadContentFromMessage } = require("@whiskeysockets/baileys")
const axios = require("axios")

module.exports = {
    run: async (dixzz, m, { from }) => {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
            const msg = quoted || m.message
            const image = msg.imageMessage || msg.viewOnceMessageV2?.message?.imageMessage

            if (!image) return dixzz.sendMessage(from, { text: "Reply foto dengan .s" })

            const stream = await downloadContentFromMessage(image, 'image')
            let buffer = Buffer.from([])
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

            // Pakai API Converter yang tinggal tempel URL base64
            const res = await axios.post('https://api.eztech.id/convert/image-to-webp', {
                image: `data:image/jpeg;base64,${buffer.toString('base64')}`
            })

            await dixzz.sendMessage(from, { sticker: Buffer.from(res.data.result, 'base64') }, { quoted: m })
        } catch (e) {
            dixzz.sendMessage(from, { text: "Gagal, coba lagi nanti." })
        }
    }
}
