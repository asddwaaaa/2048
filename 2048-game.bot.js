const { Telegraf } = require('telegraf');

// Вставь сюда свой токен от BotFather
const bot = new Telegraf('8016547523:AAG7C6_uaU9tgA82bF26pE-uCwyFU1Tszow');

bot.start((ctx) => {
    ctx.reply('Добро пожаловать в 2048 🎮', {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "▶ Играть в 2048",
                        web_app: { url: "https://two048-949z.onrender.com/" } // твоя ссылка
                    }
                ]
            ]
        }
    });
});

bot.launch();
