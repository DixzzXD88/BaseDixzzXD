const axios = require("axios");

module.exports = {
    run: async (dixzz, m, { from, args }) => {
        // Ganti m.reply jadi dixzz.sendMessage
        if (!args.length) return dixzz.sendMessage(from, { text: "⚠️ Mana teksnya, Brai? Contoh: .brat Dixzz Ganteng" }, { quoted: m });

        const text = args.join(" ");
        try {
            // Reaksi Loading
            await dixzz.sendMessage(from, { react: { text: "⏳", key: m.key } });

            // Ambil Stiker dari API
            const url = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}`;
            const response = await axios.get(url, { responseType: "arraybuffer" });
            const buffer = Buffer.from(response.data, "binary");

            // Kirim Stiker
            await dixzz.sendMessage(from, { sticker: buffer }, { quoted: m });
            
            // Reaksi Sukses
            await dixzz.sendMessage(from, { react: { text: "✅", key: m.key } });
        } catch (e) {
            console.log(e);
            dixzz.sendMessage(from, { text: "❌ API Brat lagi asma, Brai." }, { quoted: m });
        }
    }
};
