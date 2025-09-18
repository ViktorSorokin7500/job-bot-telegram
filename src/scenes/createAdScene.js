// src/scenes/createAdScene.js
const { Scenes, Markup } = require("telegraf");
const { UKRAINE_OBLASTS } = require("../utils/constants");

const createAdWizard = (supabase) => {
  const adWizard = new Scenes.WizardScene(
    "createAdWizard",

    // Крок 1: Питаємо заголовок
    async (ctx) => {
      await ctx.reply(
        'Давайте створимо нове оголошення.\n\nВведіть заголовок (наприклад, "Шукаю бухгалтера в Києві"):'
      );
      return ctx.wizard.next();
    },

    // Крок 2: Отримуємо заголовок, питаємо опис
    async (ctx) => {
      if (!ctx.message?.text) return;
      ctx.wizard.state.title = ctx.message.text;
      await ctx.reply(
        "Відмінно. Тепер введіть повний текст оголошення, опишіть деталі та вимоги:"
      );
      return ctx.wizard.next();
    },

    // Крок 3: Отримуємо опис, питаємо область
    async (ctx) => {
      if (!ctx.message?.text) return;
      ctx.wizard.state.description = ctx.message.text;

      const oblastKeyboard = Markup.keyboard(
        UKRAINE_OBLASTS.map((o) => [o]), // Кожна область на окремій кнопці для простоти
        { columns: 3 }
      ).resize();

      await ctx.reply(
        "Оберіть область, до якої відноситься оголошення (поки що можна обрати тільки одну):",
        oblastKeyboard
      );
      return ctx.wizard.next();
    },

    // Крок 4: Отримуємо область, зберігаємо в БД
    async (ctx) => {
      const oblast = ctx.message?.text;
      if (!oblast || !UKRAINE_OBLASTS.includes(oblast)) {
        await ctx.reply(
          "⛔️ Неправильна область! Будь ласка, оберіть варіант з клавіатури."
        );
        return;
      }
      ctx.wizard.state.oblast = oblast;
      const { title, description } = ctx.wizard.state;
      const telegramId = ctx.from.id;
      const oblasti = ctx.wizard.state.oblast;

      let oblastsToSave = [oblasti];
      if (oblast === "Вся Україна") {
        oblastsToSave = UKRAINE_OBLASTS.filter((o) => o !== "Вся Україна");
      }

      await ctx.reply("Зберігаю ваше оголошення...");

      try {
        // Спочатку нам треба отримати ID профілю користувача
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", telegramId)
          .single();

        if (profileError || !profile)
          throw new Error("Не вдалося знайти профіль автора.");

        // Встановлюємо термін дії оголошення (наприклад, 30 днів)
        const expires_at = new Date();
        expires_at.setDate(expires_at.getDate() + 30);

        const { error } = await supabase.from("advertisements").insert([
          {
            author_id: profile.id,
            title,
            description,
            oblasts: oblastsToSave,
            expires_at: expires_at.toISOString(),
          },
        ]);

        if (error) throw error;

        await ctx.reply(
          "✅ Ваше оголошення успішно створено та буде активним 30 днів!",
          Markup.removeKeyboard()
        );
      } catch (e) {
        console.error("Error creating ad:", e);
        await ctx.reply("На жаль, сталася помилка. Спробуйте пізніше.");
      }

      return ctx.scene.leave();
    }
  );

  return adWizard;
};

module.exports = createAdWizard;
