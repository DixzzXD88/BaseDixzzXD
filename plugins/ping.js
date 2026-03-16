module.exports = {
    run: async (dixzz, m, { from }) => {
        await dixzz.sendMessage(from, { react: { text: "⚡", key: m.key } });
        await dixzz.sendMessage(from, { text: "Pong! Dixzz Bot aktif, Brai! 🔥" }, { quoted: m });
    }
};

