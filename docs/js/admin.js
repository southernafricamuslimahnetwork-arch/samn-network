(() => {
  const $ = (id) => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const config = window.SAMN_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes("YOUR-PROJECT") &&
    config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const client = configured && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }) : null;
  let officer = null;
  let paymentTarget = null;

  function setStatus(id, message, type = "") {
    $(id).textContent = message;
    $(id).className = "status" + (type ? " " + type : "");
  }
  function showLogin(message = "") {
    $("login-panel").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
    if (message) setStatus("login-status", message, "error");
  }
  function showDashboard() {
    $("login-panel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function stageActions(app) {
    const id = esc(app.id);
    const reject = `<button class="button button-secondary" data-action="reject" data-status="${esc(app.status)}" data-id="${id}">Reject application</button>`;
    if (app.status === "pending") {
      if (!app.receipt_number) {
        return `<p class="flow-note">Step 1: confirm the payment proof and issue a receipt before endorsing.</p><div class="card-actions">${reject}</div>`;
      }
      return `<div class="card-actions"><button class="button" data-action="endorse" data-id="${id}">Endorse application (branch)</button>${reject}</div>`;
    }
    if (app.status === "endorsed") {
      const by = `<p class="flow-note">Endorsed by ${esc(app.endorsed_by_name || "a branch officer")}${app.endorsed_at ? " on " + esc(new Date(app.endorsed_at).toLocaleDateString()) : ""}.</p>`;
      if (officer && officer.role === "continental_admin") {
        return by + `<div class="card-actions"><button class="button" data-action="approve" data-id="${id}">Final approval &amp; create member record</button>${reject}</div>`;
      }
      return by + '<p class="flow-note">Awaiting final approval by the continental administrators.</p>';
    }
    return "";
  }
  // Rejection reasons: the column name in your table may differ, so we try the usual names
  // and quietly show nothing if none match.
  async function fetchRejectionNotes(ids) {
    if (!ids.length) return {};
    for (const col of ["rejection_note", "review_note", "review_notes", "notes"]) {
      const { data, error } = await client.from("membership_applications").select(`id, ${col}`).in("id", ids);
      if (!error && data) {
        const map = {};
        data.forEach((r) => { if (r[col]) map[r.id] = r[col]; });
        return map;
      }
    }
    return {};
  }
  async function loadApplications() {
    if (!client || !officer) return;
    setStatus("dashboard-status", "Loading applications…");
    $("applications").innerHTML = "";
    const selected = $("status-filter").value;
    let query = client.from("membership_applications")
      .select("id, full_name, email, phone, country_code, district, contact_method, status, created_at, reviewed_at, member_number, payment_proof_path, receipt_number, endorsed_by_name, endorsed_at")
      .order("created_at", { ascending: false }).limit(200);
    if (selected !== "all") query = query.eq("status", selected);
    const { data, error } = await query;
    if (error) {
      console.error(error);
      setStatus("dashboard-status", "Could not load applications. Confirm your officer role and database policies.", "error");
      return;
    }
    setStatus("dashboard-status", `${data.length} application(s) shown.`);
    if (!data.length) {
      $("applications").innerHTML = '<div class="empty">No applications match this filter.</div>';
      return;
    }
    const notes = await fetchRejectionNotes(data.filter((a) => a.status === "rejected").map((a) => a.id));
    $("applications").innerHTML = data.map((app) => `
      <article class="application-card">
        <div class="dashboard-head"><h3>${esc(app.full_name)}</h3><span class="pill ${esc(app.status)}">${esc(app.status)}</span></div>
        <div class="application-meta">
          <span><strong>Branch:</strong> ${esc(app.country_code)}</span>
          <span><strong>Email:</strong> ${esc(app.email)}</span>
          <span><strong>Phone:</strong> ${esc(app.phone)}</span>
          <span><strong>District:</strong> ${esc(app.district || "Not supplied")}</span>
          <span><strong>Contact:</strong> ${esc(app.contact_method || "Not supplied")}</span>
          <span><strong>Received:</strong> ${esc(new Date(app.created_at).toLocaleString())}</span>
          ${app.member_number ? `<span><strong>Member no.:</strong> ${esc(app.member_number)}</span>` : ""}
        </div>
        ${app.payment_proof_path ? `<div class="card-actions"><button class="button button-secondary" data-action="proof" data-path="${esc(app.payment_proof_path)}">View proof of payment</button></div>` : '<p class="small muted">No proof of payment on file.</p>'}
        ${app.receipt_number
          ? `<div class="card-actions"><a class="button button-secondary" href="receipt.html?id=${esc(app.id)}" target="_blank" rel="noopener">Receipt ${esc(app.receipt_number)}</a></div>`
          : (app.status !== "rejected" ? `<div class="card-actions"><button class="button button-secondary" data-action="payment" data-id="${esc(app.id)}" data-name="${esc(app.full_name)}">Record payment &amp; issue receipt</button></div>` : "")}
        ${app.status === "rejected" && notes[app.id] ? `<p class="small muted"><strong>Reason:</strong> ${esc(notes[app.id])}</p>` : ""}
        ${stageActions(app)}
        ${app.status === "approved" && app.member_number ? `<div class="card-actions"><a class="button button-secondary" href="pack.html?id=${esc(app.id)}" target="_blank" rel="noopener">Membership pack (certificate &amp; card)</a></div>` : ""}
      </article>`).join("");
  }
  async function initSession() {
    if (!client) {
      showLogin("Setup incomplete: configure js/config.js with your Supabase project URL and publishable/anon key.");
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session) { showLogin(); return; }
    const { data, error } = await client.from("samn_officer_profiles")
      .select("user_id, full_name, role, country_code").eq("user_id", session.user.id).maybeSingle();
    if (error || !data || !["continental_admin", "country_officer"].includes(data.role)) {
      await client.auth.signOut();
      showLogin("This account is not authorised as a SAMN officer. Ask the system administrator to assign an approved role.");
      return;
    }
    officer = data;
    $("officer-info").textContent = `${data.full_name || session.user.email} · ${data.role.replace("_", " ")}${data.country_code ? " · " + data.country_code : ""}`;
    showDashboard();
    await loadApplications();
  }
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) { setStatus("login-status", "Configure Supabase in js/config.js first.", "error"); return; }
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    setStatus("login-status", "Signing in…");
    const { error } = await client.auth.signInWithPassword({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password"))
    });
    button.disabled = false;
    if (error) { setStatus("login-status", "Sign-in failed. Check your details or ask the administrator for help.", "error"); return; }
    event.currentTarget.reset();
    await initSession();
  });
  $("logout").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    officer = null; showLogin();
  });
  $("refresh").addEventListener("click", loadApplications);
  $("status-filter").addEventListener("change", loadApplications);
  $("applications").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || !client) return;
    const action = button.dataset.action;
    if (action === "proof") {
      const win = window.open("", "_blank");
      const { data: signed, error: signError } = await client.storage.from("payment-proofs")
        .createSignedUrl(button.dataset.path, 300);
      if (signError || !signed) {
        if (win) win.close();
        setStatus("dashboard-status", "Could not open the proof of payment. Check your access to this branch.", "error");
      } else if (win) {
        win.opener = null;
        win.location.href = signed.signedUrl;
      }
      return;
    }
    if (action === "payment") {
      paymentTarget = button.dataset.id;
      $("payment-for").textContent = "Member: " + (button.dataset.name || "");
      setStatus("payment-status", "");
      const f = $("payment-form");
      f.elements.received_on.value = new Date().toISOString().slice(0, 10);
      $("payment-dialog").showModal();
      return;
    }
    const id = button.dataset.id;
    if (!id || !["endorse", "approve", "reject"].includes(action)) return;
    let notes = null;
    if (action === "reject") {
      notes = window.prompt("Optional reason for rejection (do not include sensitive details):");
      if (notes === null) return;
    } else if (action === "endorse") {
      if (!window.confirm("Endorse this application? You confirm payment was received and the applicant meets the membership requirements. It will go to the continental administrators for final approval.")) return;
    } else if (!window.confirm("Give final approval and create the SAMN member record?")) return;
    button.disabled = true;
    let result;
    if (action === "endorse") {
      result = await client.rpc("samn_endorse_application", { p_application_id: id });
    } else if (action === "approve") {
      result = await client.rpc("samn_final_approve", { p_application_id: id });
    } else if (button.dataset.status === "endorsed") {
      result = await client.rpc("samn_final_reject", { p_application_id: id, p_note: notes || null });
    } else {
      result = await client.rpc("samn_reject_application", { application_id: id, rejection_note: notes || null });
    }
    if (result.error) {
      console.error(result.error);
      setStatus("dashboard-status", "Action failed. Your role, branch scope, payment status and database setup were checked by the server.", "error");
    } else {
      const done = { endorse: "Application endorsed and sent for final approval.", approve: "Application approved and member record created.", reject: "Application rejected." };
      setStatus("dashboard-status", done[action], "success");
    }
    await loadApplications();
  });
  $("payment-cancel").addEventListener("click", () => $("payment-dialog").close());
  $("payment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client || !paymentTarget) return;
    const f = event.currentTarget;
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus("payment-status", "Saving…");
    const { error } = await client.rpc("samn_record_payment", {
      p_application_id: paymentTarget,
      p_amount: Number(f.elements.amount.value),
      p_method: f.elements.method.value,
      p_received_on: f.elements.received_on.value,
      p_reference: f.elements.reference.value.trim() || null
    });
    btn.disabled = false;
    if (error) {
      console.error(error);
      setStatus("payment-status", "Could not record the payment. Check your branch access and that the receipt setup SQL has been run.", "error");
      return;
    }
    $("payment-dialog").close();
    f.reset();
    setStatus("dashboard-status", "Payment recorded and receipt issued.", "success");
    await loadApplications();
  });
  initSession();
})();