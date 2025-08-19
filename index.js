import express from "express";

const app = express();

// keep raw body for debugging/signature verification if needed
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf?.toString?.() || "";
    },
  })
);

// ===== ENV =====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "change_me";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";
const AUTO_REPLY =
  (process.env.AUTO_REPLY || "true").toLowerCase() === "true";

// ===== Health =====
app.get("/", (_req, res) => {
  res.send("✅ WhatsApp bot is running.");
});

// ===== Webhook verification (GET) =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  }
  console.log("Webhook verify failed ❌", { mode, token });
  return res.sendStatus(403);
});

// ===== Webhook receiver (POST) =====
app.post("/webhook", async (req, res) => {
  // top-level debug
  console.log("🔔 Webhook POST", new Date().toISOString());
  console.log(
    "Headers:",
    JSON.stringify(
      {
        "x-hub-signature-256": req.get("x-hub-signature-256") || null,
        "user-agent": req.get("user-agent") || null,
      },
      null,
      2
    )
  );
  console.log("Body:", req.rawBody || JSON.stringify(req.body, null, 2));

  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value || {};
        const metadata = value?.metadata || {};
        const phoneId = metadata?.phone_number_id;
        const display = metadata?.display_phone_number;

        // ===== Incoming messages =====
        if (Array.isArray(value?.messages)) {
          for (const msg of value.messages) {
            const from = msg?.from;
            const type = msg?.type;
            const text = msg?.text?.body;

            console.log(
              `📩 Incoming message | phone_id=${phoneId} (${display}) | from=${from} | type=${type} | text=${JSON.stringify(
                text
              )}`
            );

            // optional auto-reply (plain text)
            if (AUTO_REPLY && WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
              try {
                const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
                const payload = {
                  messaging_product: "whatsapp",
                  to: from,
                  type: "text",
                  text: { body: `Received: ${text ?? type}` },
                };

                const r = await fetch(url, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                });

                const j = await r.json();
                console.log("📤 Send response:", JSON.stringify(j, null, 2));
              } catch (err) {
                console.error("❌ Error sending reply:", err);
              }
            } else {
              console.log(
                "ℹ️ Auto-reply skipped (AUTO_REPLY disabled or missing token/phone id)."
              );
            }
          }
        }

        // ===== Status updates (delivered/read/etc.) =====
        if (Array.isArray(value?.statuses)) {
          for (const st of value.statuses) {
            console.log(
              `📊 Status | id=${st?.id} | status=${st?.status} | to=${st?.recipient_id} | ts=${st?.timestamp}`
            );
          }
        }
      }
    }
  } catch (e) {
    console.error("❌ Webhook handling error:", e);
  }

  // Always 200 OK so Meta doesn’t retry
  return res.sendStatus(200);
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
