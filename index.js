import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ---------- CONFIG (from Render env) ----------
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v21.0";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;

// Language-selection template
const LANGUAGE_TEMPLATE_NAME = process.env.LANGUAGE_TEMPLATE_NAME || "language_selection";
const LANGUAGE_TEMPLATE_LANG = process.env.LANGUAGE_TEMPLATE_LANG || "en_US";

// Follow-up templates for button choices
const CONFIRM_TEMPLATE = process.env.CONFIRM_TEMPLATE || "hello_world";
const RESCHEDULE_TEMPLATE = process.env.RESCHEDULE_TEMPLATE || "track_my_order_test";
const FOLLOWUP_LANG = process.env.FOLLOWUP_LANG || "en_US";
// -------------------------------------------------------------------------

if (!VERIFY_TOKEN || !WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.warn("WARNING: Missing one or more required env vars: VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID");
}

// health route
app.get("/", (req, res) => res.send("WhatsApp bot (template flow) running"));

// webhook verification for Meta
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

// main webhook receiver
app.post('/webhook', (req, res) => {
  const body = req.body;

  console.log("Incoming webhook:", JSON.stringify(body, null, 2));

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {

      const messages = body.entry[0].changes[0].value.messages;
      const phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;

      messages.forEach((message) => {
        const from = message.from; // sender phone number

        // --- 1. Button Click Events ---
        if (message.type === 'button') {
          const buttonPayload = message.button.payload;
          console.log(`Button clicked: ${buttonPayload}`);

          if (buttonPayload === 'CONFIRM_INPUT') {
            sendTemplate(from, CONFIRM_TEMPLATE, FOLLOWUP_LANG);
          } else if (buttonPayload === 'RESCHEDULE_INPUT') {
            sendTemplate(from, RESCHEDULE_TEMPLATE, FOLLOWUP_LANG);
          } else {
            console.log("Unknown button payload:", buttonPayload);
          }
        }

        // --- 2. Normal Text Messages ---
        else if (message.type === 'text') {
          const msg_body = message.text.body;
          console.log(`Received message from ${from}: ${msg_body}`);

          // Send the language selection template for ANY text
          sendTemplate(from, LANGUAGE_TEMPLATE_NAME, LANGUAGE_TEMPLATE_LANG);
        }
      });

      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } else {
    res.sendStatus(404);
  }
});

// Helper: send template message
async function sendTemplate(to, templateName, languageCode = "en_US", bodyParameters = []) {
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

  if (Array.isArray(bodyParameters) && bodyParameters.length > 0) {
    payload.template.components = [
      { type: "body", parameters: bodyParameters }
    ];
  }

  try {
    console.log(`Sending template "${templateName}" to ${to} (lang=${languageCode})`);
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

// start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
