// src/scenes/registrationScene.js
const { Scenes, Markup } = require("telegraf");
const { UKRAINE_OBLASTS } = require("../utils/constants");
const mainMenu = require("../keyboards/mainMenu");
const createRegionSelector = require("../keyboards/regionSelector");

const createRegistrationWizard = (supabase) => {
  const registrationWizard = new Scenes.WizardScene(
    "registrationWizard",
    // --- Крок 1 (індекс 0): Запитуємо ім'я ---
    async (ctx) => {
      ctx.wizard.state.data = {}; // Ініціалізуємо об'єкт для даних
      ctx.wizard.state.data.selectedRegions = []; // Ініціалізуємо масив обраних областей
      await ctx.reply("Вітаю! 👋 ...Як я можу до вас звертатись?");
      return ctx.wizard.next();
    },

    // --- Крок 2 (індекс 1): Отримуємо ім'я, запитуємо телефон ---
    async (ctx) => {
      if (!ctx.message?.text) {
        await ctx.reply("Будь ласка, введіть ім'я.");
        return;
      }
      ctx.wizard.state.data.name = ctx.message.text;
      await ctx.reply(
        `Приємно познайомитись, ${ctx.wizard.state.data.name}!\nТепер надішліть ваш номер телефону.`,
        Markup.keyboard([
          Markup.button.contactRequest("📱 Надати мій номер телефону"),
        ])
          .resize()
          .oneTime()
      );
      return ctx.wizard.next();
    },

    // --- Крок 3 (індекс 2): Отримуємо телефон, показуємо вибір областей ---
    async (ctx) => {
      const phone = ctx.message?.contact?.phone_number || ctx.message?.text;
      if (!phone) {
        await ctx.reply("Будь ласка, надайте номер телефону.");
        return;
      }
      ctx.wizard.state.data.phone = phone;

      await ctx.reply(
        "Тепер оберіть одну або декілька областей:",
        createRegionSelector(ctx.wizard.state.data.selectedRegions)
      );
      // ВАЖЛИВО: ми не викликаємо wizard.next(), бо чекаємо на натискання кнопок
    },

    // --- Крок 4 (індекс 3): Отримуємо спеціалізацію ---
    async (ctx) => {
      const specialization = ctx.message?.text;
      if (specialization && specialization !== "Пропустити") {
        ctx.wizard.state.data.specialization = specialization;
      }
      await ctx.reply(
        "Напишіть кілька слів про себе (міні-резюме до 200 символів).",
        Markup.keyboard([["Пропустити"]])
          .resize()
          .oneTime()
      );
      return ctx.wizard.next();
    },

    // --- Крок 5 (індекс 4): Отримуємо біо та зберігаємо все в БД ---
    async (ctx) => {
      const bio = ctx.message?.text;
      if (bio && bio !== "Пропустити") {
        ctx.wizard.state.data.bio = bio;
      }

      const {
        name,
        phone,
        selectedRegions,
        specialization,
        bio: userBio,
      } = ctx.wizard.state.data;
      const telegramId = ctx.from.id;

      let regionsToSave = selectedRegions;
      if (selectedRegions.includes("Вся Україна")) {
        regionsToSave = UKRAINE_OBLASTS.filter((o) => o !== "Вся Україна");
      }

      await ctx.reply("Хвилинку, реєструю ваш профіль...");
      try {
        const { error } = await supabase.from("profiles").insert([
          {
            telegram_id: telegramId,
            contact_name: name,
            contact_phone: phone,
            search_oblast: regionsToSave,
            specialization: specialization || null,
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

  // --- ОБРОБНИК ДЛЯ ІНТЕРАКТИВНОЇ КЛАВІАТУРИ ---
  registrationWizard.on("callback_query", async (ctx) => {
    // Переконуємось, що цей обробник працює тільки на кроці вибору областей (індекс 2)
    if (ctx.wizard.cursor !== 2) {
      return;
    }

    const choice = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    if (choice === "region_done") {
      if (ctx.wizard.state.data.selectedRegions.length === 0) {
        await ctx.reply("❌ Ви не обрали жодної області. Оберіть хоча б одну.");
        return;
      }
      // Користувач натиснув "Готово", переходимо до наступного кроку
      await ctx.editMessageText(
        `Обрані області: ${ctx.wizard.state.data.selectedRegions.join(", ")}`
      );
      await ctx.reply(
        'Вкажіть вашу спеціалізацію (напр., "Водій", "Бухгалтер").',
        Markup.keyboard([["Пропустити"]])
          .resize()
          .oneTime()
      );
      return ctx.wizard.next(); // <--- Ось тут ми рухаємо сцену далі
    }

    const region = choice.replace("region_", "");
    const selected = ctx.wizard.state.data.selectedRegions;

    if (selected.includes(region)) {
      ctx.wizard.state.data.selectedRegions = selected.filter(
        (r) => r !== region
      );
    } else {
      ctx.wizard.state.data.selectedRegions.push(region);
    }

    await ctx.editMessageReplyMarkup(
      createRegionSelector(ctx.wizard.state.data.selectedRegions).reply_markup
    );
  });

  return registrationWizard;
};

module.exports = createRegistrationWizard;
