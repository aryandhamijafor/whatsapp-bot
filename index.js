import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ---------- CONFIG (from Render environment variables) ----------
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v21.0";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN; // accept either name
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const TEMPLATE_NAME = process.env.TEMPLATE_NAME || "language_selection";
const TEMPLATE_LANGUAGE = process.env.TEMPLATE_LANGUAGE || "en_US";

// static params for {{2}}..{{5}} (set in Render env)
const TEMPLATE_PARAM_2 = process.env.TEMPLATE_PARAM_2 || "Broadband Installation";
const TEMPLATE_PARAM_3 = process.env.TEMPLATE_PARAM_3 || "2025-08-15";
const TEMPLATE_PARAM_4 = process.env.TEMPLATE_PARAM_4 || "10:00 AM";
const TEMPLATE_PARAM_5 = process.env.TEMPLATE_PARAM_5 || "12:00 PM";
// -----------------------------------------------------------------

if (!VERIFY_TOKEN || !WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.warn("WARNING: One or more required env vars missing: VERIFY_TOKEN, WHATSAPP_TOKEN (or WHATSAPP_ACCESS_TOKEN), PHONE_NUMBER_ID");
}

// Webhook verification (Meta)
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

// Receive messages and reply with template ({{1}} dynamic from contact name)
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from; // sender number

      // get name from contacts array; fallback to phone number if missing
      const contactName = value?.contacts?.[0]?.profile?.name || from;

      // Build parameters exactly matching your template placeholders {{1}}..{{5}}
      const bodyParams = [
        { type: "text", text: contactName },       // {{1}} - dynamic
        { type: "text", text: TEMPLATE_PARAM_2 },  // {{2}} - env
        { type: "text", text: TEMPLATE_PARAM_3 },  // {{3}} - env
        { type: "text", text: TEMPLATE_PARAM_4 },  // {{4}} - env
        { type: "text", text: TEMPLATE_PARAM_5 }   // {{5}} - env
      ];

      const payload = {
        messaging_product: "whatsapp",
        to: from,
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANGUAGE },
          components: [
            {
              type: "body",
              parameters: bodyParams
            }
          ]
        }
      };

      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

      const resp = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      });

      console.log("Template send response:", JSON.stringify(resp.data, null, 2));
    }
  } catch (err) {
    // better error logging so we can diagnose quickly
    console.error("Error processing webhook / sending template:", err.response?.data || err.message || err);
  }

  // always ack to Meta
  res.sendStatus(200);
});

// health
app.get("/", (req, res) => res.send("WhatsApp bot (template) running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
