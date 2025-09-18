// src/scenes/editProfileScene.js
const { Scenes, Markup } = require("telegraf");
const { UKRAINE_OBLASTS } = require("../utils/constants");

const createEditProfileWizard = (supabase) => {
  const editProfileWizard = new Scenes.WizardScene(
    "editProfileWizard",
    // Крок 1: Питаємо, що редагувати
    async (ctx) => {
      await ctx.reply(
        "Що ви хочете змінити?",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("Ім'я", "edit_name"),
            Markup.button.callback("Телефон", "edit_phone"),
          ],
          [Markup.button.callback("Спеціалізація", "edit_specialization")],
          [Markup.button.callback("Про себе (Біо)", "edit_bio")],
          [Markup.button.callback("Область", "edit_oblast")],
          [Markup.button.callback("⬅️ Назад", "back_to_profile")],
        ])
      );
      return ctx.wizard.next();
    },
    // Крок 2: Питаємо нове значення
    async (ctx) => {
      if (
        !ctx.callbackQuery?.data ||
        ctx.callbackQuery.data === "back_to_profile"
      ) {
        await ctx.editMessageText("Редагування скасовано.");
        return ctx.scene.leave();
      }
      ctx.wizard.state.fieldToEdit = ctx.callbackQuery.data.split("_")[1];
      if (ctx.wizard.state.fieldToEdit === "oblast") {
        const buttons = UKRAINE_OBLASTS.reduce((acc, o) => {
          if (acc.length === 0 || acc[acc.length - 1].length === 3)
            acc.push([]);
          acc[acc.length - 1].push(o);
          return acc;
        }, []);
        await ctx.editMessageText("Оберіть нову область:");
        await ctx.reply(
          "Нова область:",
          Markup.keyboard(buttons).resize().oneTime()
        );
      } else {
        const fieldName = {
          name: "ім'я",
          phone: "телефон",
          specialization: "спеціалізацію",
          bio: "текст про себе",
        }[ctx.wizard.state.fieldToEdit];
        await ctx.editMessageText(
          `Введіть нове значення для поля "${fieldName}":`
        );
      }
      return ctx.wizard.next();
    },
    // Крок 3: Оновлюємо в БД
    async (ctx) => {
      const fieldToEdit = ctx.wizard.state.fieldToEdit;
      const newValue = ctx.message?.text;
      if (!newValue) {
        await ctx.reply("Будь ласка, надішліть нове значення.");
        return;
      }
      if (fieldToEdit === "oblast" && !UKRAINE_OBLASTS.includes(newValue)) {
        await ctx.reply("⛔️ Неправильна область!");
        return;
      }
      try {
        const updateData = {};
        if (fieldToEdit === "oblast") {
          let oblastsToSave = [newValue];
          if (newValue === "Вся Україна") {
            oblastsToSave = UKRAINE_OBLASTS.filter((o) => o !== "Вся Україна");
          }
          updateData["search_oblast"] = oblastsToSave;
        } else if (fieldToEdit === "name" || fieldToEdit === "phone") {
          updateData[`contact_${fieldToEdit}`] = newValue;
        } else {
          // Для bio та specialization
          updateData[fieldToEdit] = newValue;
        }
        const { error } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("telegram_id", ctx.from.id);
        if (error) throw error;
        await ctx.reply("✅ Дані успішно оновлено!", Markup.removeKeyboard());
      } catch (e) {
        console.error("Error updating profile:", e);
        await ctx.reply("Сталася помилка.");
      }
      return ctx.scene.leave();
    }
  );
  return editProfileWizard;
};
module.exports = createEditProfileWizard;
