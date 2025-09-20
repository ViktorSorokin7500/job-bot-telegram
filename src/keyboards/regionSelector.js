// src/keyboards/regionSelector.js
const { Markup } = require("telegraf");
const { UKRAINE_OBLASTS } = require("../utils/constants");

/**
 * Створює інтерактивну inline-клавіатуру для вибору областей.
 * @param {string[]} selectedRegions - Масив уже обраних областей.
 * @returns {Markup.Markup<import('telegraf/typings/core/types/typegram').InlineKeyboardMarkup>}
 */
const createRegionSelector = (selectedRegions = []) => {
  const buttons = UKRAINE_OBLASTS.map((oblast) => {
    // Якщо область вже обрана, додаємо галочку
    const text = selectedRegions.includes(oblast) ? `✅ ${oblast}` : oblast;
    return Markup.button.callback(text, `region_${oblast}`);
  });

  // Розбиваємо кнопки по 2 в ряд
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  // Додаємо кнопку "Готово" в останній ряд
  rows.push([Markup.button.callback("▶️ Готово", "region_done")]);

  return Markup.inlineKeyboard(rows);
};

module.exports = createRegionSelector;
