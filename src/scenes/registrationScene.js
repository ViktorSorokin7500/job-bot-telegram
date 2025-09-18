// src/scenes/registrationScene.js
const { Scenes, Markup } = require("telegraf");
const { UKRAINE_OBLASTS } = require("../utils/constants");
const mainMenu = require("../keyboards/mainMenu");

const createRegistrationWizard = (supabase) => {
  const registrationWizard = new Scenes.WizardScene(
    "registrationWizard",

    // Крок 1: Ім'я
    async (ctx) => {
      await ctx.reply("Вітаю! 👋 ...Як я можу до вас звертатись?");
      return ctx.wizard.next();
    },

    // Крок 2: Телефон
    async (ctx) => {
      if (!ctx.message?.text) {
        await ctx.reply("Будь ласка, введіть ім'я.");
        return;
      }
      ctx.wizard.state.name = ctx.message.text;
      await ctx.reply(
        `Приємно познайомитись, ${ctx.wizard.state.name}!\nТепер надішліть ваш номер телефону.`,
        Markup.keyboard([
          Markup.button.contactRequest("📱 Надати мій номер телефону"),
        ])
          .resize()
          .oneTime()
      );
      return ctx.wizard.next();
    },

    // Крок 3: Область
    async (ctx) => {
      const phone = ctx.message?.contact?.phone_number || ctx.message?.text;
      if (!phone) {
        await ctx.reply("Будь ласка, надайте номер телефону.");
        return;
      }
      ctx.wizard.state.phone = phone;

      const buttons = UKRAINE_OBLASTS.reduce((acc, o) => {
        if (acc.length === 0 || acc[acc.length - 1].length === 3) acc.push([]);
        acc[acc.length - 1].push(o);
        return acc;
      }, []);

      await ctx.reply(
        "Дякую! Тепер оберіть вашу основну область.",
        Markup.keyboard(buttons).resize().oneTime()
      );
      return ctx.wizard.next();
    },

    // --- НОВИЙ КРОК 4: Спеціалізація (опціонально) ---
    async (ctx) => {
      const oblast = ctx.message?.text;
      if (!oblast || !UKRAINE_OBLASTS.includes(oblast)) {
        await ctx.reply(
          "⛔️ Неправильна область! Оберіть варіант з клавіатури."
        );
        return;
      }
      ctx.wizard.state.oblast = oblast;

      await ctx.reply(
        'Вкажіть вашу спеціалізацію (напр., "Оцінка", "Фотофіксація", "Аудит", ""). Це допоможе роботодавцям знайти вас.',
        Markup.keyboard([["Пропустити"]])
          .resize()
          .oneTime()
      );
      return ctx.wizard.next();
    },

    // --- НОВИЙ КРОК 5: Біо (опціонально) ---
    async (ctx) => {
      const specialization = ctx.message?.text;
      if (specialization && specialization !== "Пропустити") {
        ctx.wizard.state.specialization = specialization;
      }
      await ctx.reply(
        "Напишіть кілька слів про себе, ваш досвід. Це ваше міні-резюме (до 200 символів).",
        Markup.keyboard([["Пропустити"]])
          .resize()
          .oneTime()
      );
      return ctx.wizard.next();
    },

    // --- Крок 6 (старий крок 4): Збереження всього в БД ---
    async (ctx) => {
      const bio = ctx.message?.text;
      if (bio && bio !== "Пропустити") {
        ctx.wizard.state.bio = bio;
      }

      const {
        name,
        phone,
        oblast,
        specialization,
        bio: userBio,
      } = ctx.wizard.state;
      const telegramId = ctx.from.id;

      let oblastsToSave = [oblast];
      if (oblast === "Вся Україна") {
        oblastsToSave = UKRAINE_OBLASTS.filter((o) => o !== "Вся Україна");
      }

      await ctx.reply("Хвилинку, реєструю ваш профіль...");
      try {
        const { error } = await supabase.from("profiles").insert([
          {
            telegram_id: telegramId,
            contact_name: name,
            contact_phone: phone,
            search_oblast: oblastsToSave,
            specialization: specialization || null, // Зберігаємо null, якщо пропустили
            bio: userBio || null,
          },
        ]);
        if (error) throw error;
        await ctx.reply("✅ Вітаю, вас успішно зареєстровано!", mainMenu);
      } catch (dbError) {
        console.error("Error saving profile:", dbError);
        await ctx.reply("На жаль, сталася помилка.");
      }
      return ctx.scene.leave();
    }
  );
  return registrationWizard;
};
module.exports = createRegistrationWizard;
