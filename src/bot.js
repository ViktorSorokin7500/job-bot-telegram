// src/bot.js
require("dotenv").config({ path: "./.env" }); // Шлях до .env, якщо він лежить в папці src
const createEditProfileWizard = require("./scenes/editProfileScene");

const { Telegraf, Scenes, session, Markup } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
// Імпортуємо ФУНКЦІЮ для створення сцени
const createRegistrationWizard = require("./scenes/registrationScene");
const mainMenu = require("./keyboards/mainMenu");
const createAdWizard = require("./scenes/createAdScene");
const createEditAdWizard = require("./scenes/editAdScene");
const { UKRAINE_OBLASTS } = require("./utils/constants");

// --- Ініціалізація ---
console.log("Starting bot...");

const formatAdMessage = (ad, currentIndex, total) => {
  return [
    `📄 ${ad.title} (${currentIndex + 1}/${total})`,
    ``,
    `${ad.description}`,
    ``,
    `📍 Область: ${ad.oblasts.join(", ")}`,
    `👤 Контакт: ${ad.profiles.contact_name}`,
    `📞 Телефон: ${ad.profiles.contact_phone}`,
  ].join("\n");
};

const formatMyAdMessage = (ad, currentIndex, total) => {
  return [
    `📄 ${ad.title} (${currentIndex + 1}/${total})`,
    ``,
    `${ad.description}`,
    ``,
    `📍 Область: ${ad.oblasts.join(", ")}`,
    `📅 Активно до: ${new Date(ad.expires_at).toLocaleDateString("uk-UA")}`,
  ].join("\n");
};

const formatWorkerMessage = (worker, currentIndex, total) => {
  return [
    `👤 ${worker.contact_name} (${currentIndex + 1}/${total})`,
    ``,
    `Спеціалізація: ${worker.specialization || "Не вказано"}`,
    `Про себе: ${worker.bio || "Не вказано"}`,
    ``,
    `📍 Шукає в: ${worker.search_oblast.join(", ")}`,
    `📞 Телефон: ${worker.contact_phone}`,
  ].join("\n");
};

const createPaginationKeyboard = (type, resultsLength) => {
  const prev_action = `prev_${type}`; // 'prev_ad' або 'prev_worker'
  const next_action = `next_${type}`; // 'next_ad' або 'next_worker'

  return Markup.inlineKeyboard([
    [
      Markup.button.callback("⬅️", prev_action, resultsLength <= 1),
      Markup.button.callback("➡️", next_action, resultsLength <= 1),
    ],
    [Markup.button.callback("⬅️ Назад в меню", "back_to_menu")],
  ]);
};

const createMyAdsPaginationKeyboard = (adId, totalAds) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✏️ Редагувати", `edit_ad:${adId}`),
      Markup.button.callback("🗑️ Видалити", `delete_ad:${adId}`),
    ],
    [
      Markup.button.callback("⬅️", "prev_my_ad", totalAds <= 1),
      Markup.button.callback("➡️", "next_my_ad", totalAds <= 1),
    ],
  ]);
};

const handleMyAdsPagination = async (ctx, direction) => {
  if (!ctx.session?.myAds || ctx.session.myAds.length === 0) {
    return ctx.answerCbQuery("Список оголошень застарів.", true);
  }

  let { myAdsIndex, myAds } = ctx.session;

  if (direction === "next") {
    myAdsIndex = (myAdsIndex + 1) % myAds.length;
  } else {
    myAdsIndex = (myAdsIndex - 1 + myAds.length) % myAds.length;
  }
  ctx.session.myAdsIndex = myAdsIndex;

  const ad = myAds[myAdsIndex];
  const message = formatMyAdMessage(ad, myAdsIndex, myAds.length);

  try {
    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      ...createMyAdsPaginationKeyboard(ad.id, myAds.length),
    });
  } catch (e) {
    if (!e.message.includes("message is not modified")) console.error(e);
  } finally {
    await ctx.answerCbQuery();
  }
};

if (
  !process.env.BOT_TOKEN ||
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_ANON_KEY
) {
  console.error("ERROR: Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const handlePagination = async (ctx, direction, type) => {
  if (!ctx.session?.searchResults || ctx.session.searchResults.length === 0) {
    await ctx.answerCbQuery("Результати пошуку застаріли.");
    return ctx.editMessageText("Спробуйте новий пошук.");
  }

  const { searchResults } = ctx.session;
  let { currentIndex } = ctx.session;

  if (direction === "next") {
    currentIndex = (currentIndex + 1) % searchResults.length;
  } else {
    currentIndex =
      (currentIndex - 1 + searchResults.length) % searchResults.length;
  }
  ctx.session.currentIndex = currentIndex;

  const item = searchResults[currentIndex];
  // Викликаємо потрібну функцію форматування в залежності від типу
  const message =
    type === "ad"
      ? formatAdMessage(item, currentIndex, searchResults.length)
      : formatWorkerMessage(item, currentIndex, searchResults.length);

  try {
    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      ...createPaginationKeyboard(type, searchResults.length),
    });
  } catch (e) {
    if (!e.message.includes("message is not modified")) {
      console.error("Error on pagination:", e);
    }
  } finally {
    await ctx.answerCbQuery();
  }
};

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- СТВОРЕННЯ ТА РЕЄСТРАЦІЯ СЦЕНИ (ОСЬ ТУТ ВИПРАВЛЕННЯ) ---
// 1. Викликаємо функцію-фабрику і передаємо їй supabase, щоб отримати готовий об'єкт сцени
const registrationScene = createRegistrationWizard(supabase);
const editProfileScene = createEditProfileWizard(supabase);
const createAdScene = createAdWizard(supabase);
const editAdScene = createEditAdWizard(supabase);

// 2. Реєструємо вже готовий об'єкт сцени у Stage
const stage = new Scenes.Stage([
  registrationScene,
  editProfileScene,
  createAdScene,
  editAdScene,
]);

stage.command("cancel", async (ctx) => {
  await ctx.reply("Дію скасовано. Повернення в головне меню.", mainMenu);
  return ctx.scene.leave();
});

const checkSubscription = async (ctx, next) => {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("subscription_end_date")
      .eq("telegram_id", ctx.from.id)
      .single();

    if (error || !profile) {
      // Якщо раптом профіль не знайдено, просимо перезапустити
      return ctx.reply(
        "Не вдалося перевірити ваш профіль. Будь ласка, спробуйте /start."
      );
    }

    const subscriptionEndDate = new Date(profile.subscription_end_date);
    const now = new Date();

    // Перевіряємо, чи дата підписки більша за поточну дату
    if (subscriptionEndDate > now) {
      // Підписка активна, пропускаємо до наступної функції (основного обробника)
      return next();
    } else {
      // Підписка неактивна, блокуємо
      const paymentLink = "https://www.liqpay.ua/checkout/..."; // ЗАМІНІТЬ ЦЕ НА ВАШЕ РЕАЛЬНЕ ПОСИЛАННЯ

      await ctx.replyWithHTML(
        "🔴 Ваша підписка закінчилася.\n\n" +
          "Щоб продовжити користуватися функціями пошуку та створення оголошень, " +
          `будь ласка, сплатіть 50 грн/рік.`,
        Markup.inlineKeyboard([
          [Markup.button.url("💳 Сплатити 50 грн", paymentLink)],
          [Markup.button.callback("Я вже сплатив(ла)", "check_payment_later")], // Кнопка на майбутнє
        ])
      );
    }
  } catch (e) {
    console.error("Subscription check error:", e);
    await ctx.reply("Сталася помилка під час перевірки вашої підписки.");
  }
};

bot.use(session());
bot.use(stage.middleware());

// --- Обробники команд ---
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`User with Telegram ID ${telegramId} started the bot.`);

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, is_active")
      .eq("telegram_id", telegramId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      console.log(
        `User found in DB. ID: ${data.id}, Is Active: ${data.is_active}`
      );
      await ctx.reply(`З поверненням, ${ctx.from.first_name}!`, mainMenu);
      // Тут буде логіка для відображення головного меню
    } else {
      console.log("New user. Entering registration scene...");
      await ctx.scene.enter("registrationWizard");
    }
  } catch (dbError) {
    console.error("Database error on /start:", dbError);
    await ctx.reply(
      "Виникла помилка під час роботи з базою даних. Спробуйте пізніше."
    );
  }
});

bot.hears("⚙️ Мій профіль", async (ctx) => {
  const telegramId = ctx.from.id;

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (error || !profile) {
      await ctx.reply(
        "Не вдалося знайти ваш профіль. Спробуйте виконати /start."
      );
      throw new Error(error?.message || "Profile not found");
    }

    // --- Нова динамічна логіка ---
    let statusMessage, visibilityButton;

    if (profile.is_active) {
      statusMessage =
        "🟢 Статус: Видимий (відображається в пошуку працівників)";
      visibilityButton = Markup.button.callback(
        "🔴 Приховати з пошуку",
        "hide_profile"
      );
    } else {
      statusMessage = "🔴 Статус: Прихований (не відображається в пошуку)";
      visibilityButton = Markup.button.callback(
        "🟢 Зробити видимим",
        "unhide_profile"
      );
    }
    const profileMessage = [
      `👤 Ваш профіль`,
      ``,
      `Ім'я: ${profile.contact_name}`,
      `Телефон: ${profile.contact_phone}`,
      `Основна область: ${profile.search_oblast.join(", ")}`,
      `Спеціалізація: ${profile.specialization || "Не вказано"}`,
      `Про себе: ${profile.bio || "Не вказано"}`,
      ``,
      statusMessage, // Додаємо рядок зі статусом
      ``,
      `📅 Підписка активна до: ${new Date(
        profile.subscription_end_date
      ).toLocaleDateString("uk-UA")}`,
    ].join("\n");

    await ctx.replyWithHTML(
      profileMessage,
      Markup.inlineKeyboard([
        [visibilityButton], // Динамічна кнопка видимості
        [Markup.button.callback("✏️ Редагувати профіль", "edit_profile")],
      ])
    );
  } catch (e) {
    console.error("Error fetching profile:", e);
    await ctx.reply("Сталася помилка при завантаженні профілю.");
  }
});

bot.action("edit_profile", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("Переходжу в режим редагування...");
  return ctx.scene.enter("editProfileWizard"); // Входимо в сцену редагування
});

bot.action("hide_profile", async (ctx) => {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("telegram_id", ctx.from.id);

    if (error) throw error;

    await ctx.answerCbQuery("Ваш профіль приховано з пошуку.");
    // Оновлюємо повідомлення, щоб показати новий статус
    await ctx.editMessageText(
      "Ваш профіль тепер прихований і не буде відображатись у пошуку працівників."
    );
    await ctx.reply("Головне меню:", mainMenu);
  } catch (e) {
    console.error("Error hiding profile:", e);
    await ctx.answerCbQuery("Помилка!", true);
  }
});

// Обробник для кнопки "Зробити профіль видимим"
bot.action("unhide_profile", async (ctx) => {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: true })
      .eq("telegram_id", ctx.from.id);

    if (error) throw error;

    await ctx.answerCbQuery("Ваш профіль знову видимий.");
    await ctx.editMessageText(
      "Ваш профіль знову активний і буде відображатись у пошуку працівників."
    );
    await ctx.reply("Головне меню:", mainMenu);
  } catch (e) {
    console.error("Error unhiding profile:", e);
    await ctx.answerCbQuery("Помилка!", true);
  }
});

bot.hears("➕ Створити оголошення", checkSubscription, (ctx) => {
  // Перевірка чи активна підписка буде тут згодом
  return ctx.scene.enter("createAdWizard");
});

bot.hears("📄 Мої оголошення", checkSubscription, async (ctx) => {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", ctx.from.id)
      .single();
    if (!profile) throw new Error("Профіль не знайдено.");

    const { data: ads, error } = await supabase
      .from("advertisements")
      .select("*")
      .eq("author_id", profile.id)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString());

    if (error) throw error;

    if (!ads || ads.length === 0) {
      return ctx.reply(
        "У вас немає активних оголошень.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "➕ Створити нове оголошення",
              "create_ad_from_list"
            ),
          ],
        ])
      );
    }

    // Зберігаємо оголошення в сесію для пагінації
    ctx.session.myAds = ads;
    ctx.session.myAdsIndex = 0;

    const ad = ads[0];
    const message = formatMyAdMessage(ad, 0, ads.length);

    await ctx.replyWithHTML(
      message,
      createMyAdsPaginationKeyboard(ads[0].id, ads.length)
    );
  } catch (e) {
    console.error("Error fetching my ads:", e);
    await ctx.reply("Виникла помилка при завантаженні ваших оголошень.");
  }
});

// Додамо обробник для інлайн-кнопки
bot.action("create_ad_from_list", (ctx) => {
  ctx.answerCbQuery();
  return ctx.scene.enter("createAdWizard");
});

bot.hears("🔍 Знайти роботу", checkSubscription, async (ctx) => {
  ctx.session.search_type = "job";
  const oblastKeyboard = Markup.keyboard(
    UKRAINE_OBLASTS.map((o) => [o]),
    { columns: 3 }
  )
    .resize()
    .oneTime();

  await ctx.reply("Оберіть область для пошуку:", oblastKeyboard);
});

bot.hears("👤 Знайти працівника", checkSubscription, async (ctx) => {
  ctx.session.search_type = "worker"; // <-- Запам'ятовуємо, що шукаємо працівника
  const oblastKeyboard = Markup.keyboard(
    UKRAINE_OBLASTS.map((o) => [o]),
    { columns: 3 }
  )
    .resize()
    .oneTime();
  await ctx.reply("Оберіть область для пошуку:", oblastKeyboard);
});

bot.hears(UKRAINE_OBLASTS, async (ctx) => {
  const selectedOblast = ctx.message.text;
  const searchType = ctx.session.search_type;

  if (!searchType) {
    return ctx.reply(
      "Будь ласка, спочатку оберіть, що ви хочете шукати.",
      mainMenu
    );
  }

  await ctx.reply(
    `🔎 Шукаю по запиту в області "${selectedOblast}"...`,
    Markup.removeKeyboard()
  );

  try {
    if (searchType === "job") {
      // --- ЛОГІКА ПОШУКУ РОБОТИ (ЗАЛИШАЄТЬСЯ БЕЗ ЗМІН) ---
      const query = supabase
        .from("advertisements")
        .select("*, profiles(contact_name, contact_phone)")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      if (selectedOblast !== "Вся Україна") {
        query.contains("oblasts", [selectedOblast]);
      }

      const { data: ads, error } = await query;
      if (error) throw error;
      if (!ads || ads.length === 0)
        return ctx.reply("На жаль, за вашим запитом нічого не знайдено.");

      ctx.session.searchResults = ads;
      ctx.session.currentIndex = 0;

      const ad = ads[0];
      const message = formatAdMessage(ad, 0, ads.length);
      await ctx.replyWithHTML(
        message,
        createPaginationKeyboard("ad", ads.length)
      );
    } else if (searchType === "worker") {
      // --- ОНОВЛЕНА ЛОГІКА ПОШУКУ ПРАЦІВНИКІВ ---

      // Викликаємо нашу нову функцію з бази даних
      const { data: workers, error } = await supabase.rpc(
        "search_workers_sorted",
        {
          region: selectedOblast,
        }
      );

      if (error) throw error;
      if (!workers || workers.length === 0)
        return ctx.reply("На жаль, за вашим запитом не знайдено працівників.");

      ctx.session.searchResults = workers;
      ctx.session.currentIndex = 0;

      const worker = workers[0];
      const message = formatWorkerMessage(worker, 0, workers.length);
      await ctx.replyWithHTML(
        message,
        createPaginationKeyboard("worker", workers.length)
      );
    }
  } catch (e) {
    console.error("Error during search:", e);
    await ctx.reply("Сталася помилка під час пошуку.");
  } finally {
    ctx.session.search_type = null;
  }
});

bot.action(/^delete_ad:(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  await ctx.answerCbQuery();
  await ctx.reply(
    "Ви впевнені, що хочете видалити це оголошення? Цю дію не можна буде скасувати.",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "Так, видалити назавжди",
          `confirm_delete_ad:${adId}`
        ),
        Markup.button.callback("Ні", "cancel_ad_deletion"),
      ],
    ])
  );
});

// Обробник підтвердження видалення
// Додано ^ та $ для точного співпадіння
bot.action(/^confirm_delete_ad:(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  try {
    const { error } = await supabase
      .from("advertisements")
      .delete()
      .eq("id", adId);

    if (error) throw error;

    await ctx.answerCbQuery("Оголошення видалено.");
    await ctx.editMessageText("✅ Оголошення було успішно видалено.");
    // Повертаємо користувача в головне меню
    await ctx.reply("Головне меню:", mainMenu);
  } catch (e) {
    console.error("Error deleting ad:", e);
    await ctx.answerCbQuery("Помилка видалення!", true);
  }
});

// Обробник скасування видалення
bot.action("cancel_ad_deletion", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("Дію скасовано.");
});

bot.action("next_ad", (ctx) => handlePagination(ctx, "next", "ad"));
bot.action("prev_ad", (ctx) => handlePagination(ctx, "prev", "ad"));
bot.action("next_worker", (ctx) => handlePagination(ctx, "next", "worker"));
bot.action("prev_worker", (ctx) => handlePagination(ctx, "prev", "worker"));
bot.action("next_my_ad", (ctx) => handleMyAdsPagination(ctx, "next"));
bot.action("prev_my_ad", (ctx) => handleMyAdsPagination(ctx, "prev"));

bot.command("menu", async (ctx) => {
  // Просто надсилаємо повідомлення з головною клавіатурою
  await ctx.reply("Головне меню:", mainMenu);
});

bot.action("back_to_menu", async (ctx) => {
  await ctx.answerCbQuery();
  // Видаляємо повідомлення з оголошенням, щоб не засмічувати чат
  await ctx.deleteMessage();
  // Показуємо головне меню
  await ctx.reply("Головне меню:", mainMenu);
});

bot.action(/edit_ad:(.+)/, (ctx) => {
  const adId = ctx.match[1];
  ctx.answerCbQuery();
  // Входимо в сцену і передаємо їй ID оголошення
  ctx.scene.enter("editAdWizard", { adId });
});

bot
  .launch()
  .then(() => {
    console.log("✅ Bot has been started successfully!");
  })
  .catch((err) => {
    console.error("❌ Failed to start the bot:", err);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
