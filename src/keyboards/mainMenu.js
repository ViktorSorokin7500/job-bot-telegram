const { Markup } = require("telegraf");

const mainMenu = Markup.keyboard([
  ["🔍 Знайти роботу", "👤 Знайти працівника"],
  ["📄 Мої оголошення", "➕ Створити оголошення"], // <-- Змінено тут
  ["⚙️ Мій профіль"],
]).resize();

module.exports = mainMenu;
