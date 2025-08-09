import express from "express";

const app = express();
app.use(express.json());

// ---------- CONFIG (all via Render environment variables) ----------
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v21.0";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;                // must match Meta webhook verify token
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;            // your access token
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;          // phone number ID (numeric)
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || "language_selection";
const TEMPLATE_LANGUAGE = process.env.TEMPLATE_LANGUAGE || "en_US";

// Static template param env variables for {{2}}..{{5}}
const PARAM_2 = process.env.TEMPLATE_PARAM_2 || "Broadband Installation";
const PARAM_3 = process.env.TEMPLATE_PARAM_3 || "2025-08-15";
const PARAM_4 = process.env.TEMPLATE_PARAM_4 || "10:00 AM";
const PARAM_5 = process.env.TEMPLATE_PARAM_5 || "12:00 PM";
// -------------------------------------------------------------------

if (!VERIFY_TOKEN || !WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.warn("Missing one or more required env vars: VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID");
}

// Webhook verification
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
      const from = msg.from; // sender number, e.g., "9715...."

      // Try to get name from contacts array; fallback to phone ID
      const contactName = value?.contacts?.[0]?.profile?.name || from;

      // Build parameters array: first param is sender name ({{1}}), rest are static from env
      const bodyParams = [
        { type: "text", text: contactName }, // {{1}}
        { type: "text", text: PARAM_2 },     // {{2}}
        { type: "text", text: PARAM_3 },     // {{3}}
        { type: "text", text: PARAM_4 },     // {{4}}
        { type: "text", text: PARAM_5 }      // {{5}}
      ];

      // Build template payload (must include components.body.parameters exactly matching placeholders)
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
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      console.log("Template send response:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
  }

  // Acknowledge Meta
  res.sendStatus(200);
});

// Simple healthcheck
app.get("/", (req, res) => res.send("WhatsApp bot (template) running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
import express from "express";

const app = express();
app.use(express.json());

// Config from environment (set these in Render)
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v21.0";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || "language_selection";
const TEMPLATE_LANGUAGE = process.env.TEMPLATE_LANGUAGE || "en_US";
const TEMPLATE_PARAMS_RAW = process.env.TEMPLATE_PARAMS || ""; // optional comma-separated params

// Helper: build template payload (adds body params if provided)
function buildTemplatePayload(to) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANGUAGE }
    }
  };

  const params = TEMPLATE_PARAMS_RAW
    .split(",")
    .map(p => p.trim())
    .filter(Boolean);

  if (params.length > 0) {
    payload.template.components = [
      {
        type: "body",
        parameters: params.map(p => ({ type: "text", text: p }))
      }
    ];
  }

  return payload;
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

// Incoming messages — auto-send template reply
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (messages && messages.length > 0) {
      const incoming = messages[0];
      const from = incoming.from; // dynamic recipient (sender of the message)
      const text = incoming.text?.body || "";

      // Optional: log inbound message
      console.log(`Incoming from ${from}: ${text}`);

      // Build payload for the template (uses TEMPLATE_PARAMS if you set them)
      const payload = buildTemplatePayload(from);

      // Send template
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      console.log("Template send response:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
  }

  // Acknowledge Meta
  res.sendStatus(200);
});

// quick healthcheck
app.get("/", (req, res) => res.send("WhatsApp bot running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
