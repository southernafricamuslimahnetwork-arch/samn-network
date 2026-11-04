(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
  const form = document.getElementById("membership-form");
  if (!form) return;
  const status = document.getElementById("form-status");
  const config = window.SAMN_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes("YOUR-PROJECT") &&
    config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const client = configured && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "status";
    if (!client) {
      status.textContent = "Setup incomplete: add your Supabase project URL and publishable/anon key in js/config.js.";
      status.classList.add("error");
      return;
    }
    const data = new FormData(form);
    if (!data.get("consent")) {
      status.textContent = "Please confirm consent before submitting.";
      status.classList.add("error");
      return;
    }
    if (!data.get("eligibility")) {
      status.textContent = "Please confirm the eligibility statement before submitting.";
      status.classList.add("error");
      return;
    }
    const proof = form.querySelector('input[name="payment_proof"]')?.files?.[0];
    const proofTypes = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
    if (!proof) {
      status.textContent = "Please attach your proof of payment.";
      status.classList.add("error");
      return;
    }
    if (!proofTypes[proof.type]) {
      status.textContent = "Proof of payment must be a PDF, JPG or PNG file.";
      status.classList.add("error");
      return;
    }
    if (proof.size > 5 * 1024 * 1024) {
      status.textContent = "Proof of payment must be 5 MB or smaller.";
      status.classList.add("error");
      return;
    }
    const payload = {
      full_name: String(data.get("full_name") || "").trim(),
      email: String(data.get("email") || "").trim().toLowerCase(),
      phone: String(data.get("phone") || "").trim(),
      country_code: String(data.get("country_code") || ""),
      district: String(data.get("district") || "").trim() || null,
      contact_method: String(data.get("contact_method") || "WhatsApp"),
      consent: true
    };
    if (payload.full_name.length < 2 || payload.full_name.length > 120 ||
        payload.email.length > 254 || payload.phone.length < 5 || payload.phone.length > 40) {
      status.textContent = "Please check your name, email and phone number.";
      status.classList.add("error");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Submitting…";
    try {
      const folder = /^[A-Z]{2,5}$/.test(payload.country_code) ? payload.country_code : "OTHER";
      const proofPath = `${folder}/${crypto.randomUUID()}.${proofTypes[proof.type]}`;
      const { error: uploadError } = await client.storage.from("payment-proofs")
        .upload(proofPath, proof, { contentType: proof.type, upsert: false });
      if (uploadError) throw uploadError;
      payload.payment_proof_path = proofPath;
      const { error } = await client.from("membership_applications").insert(payload);
      if (error) throw error;
      form.reset();
      status.textContent = "Application submitted. An authorised SAMN officer will review it. Please keep your contact details available.";
      status.classList.add("success");
    } catch (error) {
      console.error("SAMN application submission failed:", error);
      status.textContent = "We could not submit your application. Please check your connection or contact your country branch. Do not submit the form repeatedly.";
      status.classList.add("error");
    } finally {
      button.disabled = false;
      button.textContent = "Submit application";
    }
  });
})();
