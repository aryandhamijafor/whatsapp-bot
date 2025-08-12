// index.js (final)
import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ---------- CONFIG (from Render env) ----------
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v21.0";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;

// Template names & languages (change in Render env if needed)
const LANGUAGE_TEMPLATE = process.env.LANGUAGE_TEMPLATE_NAME || "language_selection";
const LANGUAGE_TEMPLATE_LANG = process.env.LANGUAGE_TEMPLATE_LANG || "en_US";

const CONFIRM_TEMPLATE = process.env.CONFIRM_TEMPLATE || "hello_world";
const RESCHEDULE_TEMPLATE = process.env.RESCHEDULE_TEMPLATE || "track_my_order_test";
const FOLLOWUP_LANG = process.env.FOLLOWUP_LANG || "en_US";

// Static values for language_selection placeholders {{2}}..{{5}} (set in Render env)
const TEMPLATE_PARAM_2 = process.env.TEMPLATE_PARAM_2 || "Broadband Installation";
const TEMPLATE_PARAM_3 = process.env.TEMPLATE_PARAM_3 || "2025-08-15";
const TEMPLATE_PARAM_4 = process.env.TEMPLATE_PARAM_4 || "10:00 AM";
const TEMPLATE_PARAM_5 = process.env.TEMPLATE_PARAM_5 || "12:00 PM";
// -------------------------------------------------------------------------

// quick checks
if (!VERIFY_TOKEN || !WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.warn("WARNING: set VERIFY_TOKEN, WHATSAPP_TOKEN (or WHATSAPP_ACCESS_TOKEN), PHONE_NUMBER_ID in Render env");
}

// health check
app.get("/", (req, res) => res.send("WhatsApp bot (final) running"));

// webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// helper to send a template (parameters optional)
async function sendTemplate(to, templateName, languageCode = "en_US", parameters = []) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode }
    }
  };

  if (Array.isArray(parameters) && parameters.length > 0) {
    payload.template.components = [{ type: "body", parameters }];
  }

  try {
    console.log(`Sending template "${templateName}" to ${to} (lang=${languageCode}) params=${parameters.length}`);
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 15000
    });
    console.log("Template send response:", JSON.stringify(resp.data, null, 2));
    return resp.data;
  } catch (err) {
    console.error("Error sending template:", err.response?.data || err.message || err);
    throw err;
  }
}

// Build language_selection parameters (exactly 5: first is contact name)
function buildLanguageSelectionParams(contactName) {
  return [
    { type: "text", text: contactName },           // {{1}} dynamic
    { type: "text", text: TEMPLATE_PARAM_2 },      // {{2}}
    { type: "text", text: TEMPLATE_PARAM_3 },      // {{3}}
    { type: "text", text: TEMPLATE_PARAM_4 },      // {{4}}
    { type: "text", text: TEMPLATE_PARAM_5 }       // {{5}}
  ];
}

// Build track_my_order_test params (exactly 4; hardcoded test values for now)
function buildTrackOrderParams() {
  return [
    { type: "text", text: "test1" },
    { type: "text", text: "test2" },
    { type: "text", text: "test3" },
    { type: "text", text: "test4" }
  ];
}

// Main webhook handler
app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    // Process each message (usually there's one)
    for (const msg of messages) {
      const from = msg.from; // user number (no +)
      const contactName = value?.contacts?.[0]?.profile?.name || from;

      // BUTTON: some webhooks use type "button" with button.payload/text
      if (msg.type === "button") {
        const payload = (msg.button?.payload || msg.button?.text || "").toString().trim();
        console.log(`Button event from ${from}: payload="${payload}"`);

        if (payload.toLowerCase() === "confirm") {
          // Confirm -> send hello_world (assume no params)
          await sendTemplate(from, CONFIRM_TEMPLATE, FOLLOWUP_LANG, []);
        } else if (payload.toLowerCase() === "reschedule") {
          // Reschedule -> send track_my_order_test with 4 params
          await sendTemplate(from, RESCHEDULE_TEMPLATE, FOLLOWUP_LANG, buildTrackOrderParams());
        } else {
          console.log("Unknown button payload:", payload);
        }
      }
      // INTERACTIVE (newer shape) e.g., interactive.button_reply
      else if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
        const payloadId = (msg.interactive.button_reply?.id || "").toString().trim();
        const title = (msg.interactive.button_reply?.title || "").toString().trim();
        console.log(`Interactive button_reply from ${from}: id="${payloadId}", title="${title}"`);

        const key = (payloadId || title).toLowerCase();
        if (key === "confirm" || key === "confirm_input" || key.includes("confirm")) {
          await sendTemplate(from, CONFIRM_TEMPLATE, FOLLOWUP_LANG, []);
        } else if (key === "reschedule" || key === "reschedule_input" || key.includes("reschedule")) {
          await sendTemplate(from, RESCHEDULE_TEMPLATE, FOLLOWUP_LANG, buildTrackOrderParams());
        } else {
          console.log("Unknown interactive button key:", key);
        }
      }
      // TEXT or other media -> send the language_selection template (5 params)
      else if (msg.type === "text" || msg.type === "image" || msg.type === "video" || msg.type === "audio") {
        console.log(`Received message from ${from}, sending ${LANGUAGE_TEMPLATE}`);
        const params = buildLanguageSelectionParams(contactName);
        await sendTemplate(from, LANGUAGE_TEMPLATE, LANGUAGE_TEMPLATE_LANG, params);
      } else {
        console.log("Unhandled message type:", msg.type);
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook processing error:", err.response?.data || err.message || err);
    return res.sendStatus(500);
  }
});

// Start server - use Render's PORT if provided
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
