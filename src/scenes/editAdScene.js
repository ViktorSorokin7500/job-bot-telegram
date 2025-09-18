const { Scenes, Markup } = require("telegraf");

const createEditAdWizard = (supabase) => {
  const editAdWizard = new Scenes.WizardScene(
    "editAdWizard",
    // Крок 1: Питаємо, що редагувати
    async (ctx) => {
      const adId = ctx.scene.state.adId;
      if (!adId) {
        await ctx.reply("Помилка. Не знайдено ID оголошення.");
        return ctx.scene.leave();
      }
      await ctx.reply(
        "Що ви хочете змінити в оголошенні?",
        Markup.inlineKeyboard([
          [Markup.button.callback("Заголовок", "edit_title")],
          [Markup.button.callback("Опис", "edit_description")],
          [Markup.button.callback("⬅️ Назад", "back_to_ads")],
        ])
      );
      return ctx.wizard.next();
    },
    // Крок 2: Питаємо нове значення
    async (ctx) => {
      if (
        !ctx.callbackQuery?.data ||
        ctx.callbackQuery.data === "back_to_ads"
      ) {
        await ctx.editMessageText("Редагування скасовано.");
        return ctx.scene.leave();
      }
      ctx.wizard.state.fieldToEdit = ctx.callbackQuery.data.split("_")[1]; // 'title' або 'description'
      await ctx.editMessageText(
        `Введіть новий ${
          ctx.wizard.state.fieldToEdit === "title" ? "заголовок" : "опис"
        }:`
      );
      return ctx.wizard.next();
    },
    // Крок 3: Оновлюємо в БД
    async (ctx) => {
      const newValue = ctx.message?.text;
      if (!newValue) return ctx.reply("Будь ласка, введіть значення.");

      const { adId, fieldToEdit } = ctx.wizard.state;
      const updateData = { [fieldToEdit]: newValue };

      try {
        const { error } = await supabase
          .from("advertisements")
          .update(updateData)
          .eq("id", adId);
        if (error) throw error;
        await ctx.reply("✅ Оголошення успішно оновлено.");
      } catch (e) {
        console.error("Error updating ad:", e);
        await ctx.reply("Помилка оновлення.");
      }
      return ctx.scene.leave();
    }
  );
  return editAdWizard;
};
module.exports = createEditAdWizard;
