// cron/deactivateExpiredAds.js
require("dotenv").config({ path: "./.env" }); // Шлях до .env з кореневої папки
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const run = async () => {
  console.log("CRON JOB: Starting to deactivate expired ads...");

  try {
    const now = new Date().toISOString();

    // Ми будемо "м'яко видаляти" - ставити is_active = false
    const { data, error } = await supabase
      .from("advertisements")
      .update({ is_active: false })
      .lt("expires_at", now) // lt = less than (менше ніж)
      .eq("is_active", true); // Оновлюємо тільки ті, що ще активні

    if (error) {
      throw error;
    }

    // data - це масив оновлених рядків. Ми можемо порахувати їх кількість.
    if (data && data.length > 0) {
      console.log(`CRON JOB: Successfully deactivated ${data.length} ad(s).`);
    } else {
      console.log("CRON JOB: No expired ads found to deactivate.");
    }
  } catch (e) {
    console.error("CRON JOB: An error occurred:", e.message);
  } finally {
    console.log("CRON JOB: Finished.");
  }
};

// Запускаємо функцію
run();
