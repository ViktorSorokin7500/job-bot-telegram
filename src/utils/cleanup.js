const deactivateExpiredAds = async (supabase) => {
  console.log("CLEANUP: Checking for expired ads...");
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("advertisements")
      .update({ is_active: false })
      .lt("expires_at", now)
      .eq("is_active", true);

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`CLEANUP: Successfully deactivated ${data.length} ad(s).`);
    } else {
      console.log("CLEANUP: No expired ads found.");
    }
  } catch (e) {
    console.error("CLEANUP: An error occurred:", e.message);
  }
};

module.exports = { deactivateExpiredAds };
