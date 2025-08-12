import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const GRAPH_API_VERSION = "v21.0";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ✅ Send Template with 5 hardcoded params
async function sendTemplate(to, templateName, languageCode = "en_US") {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const bodyParameters = [
    { type: "text", text: "test1" },
    { type: "text", text: "test2" },
    { type: "text", text: "test3" },
    { type: "text", text: "test4" },
    { type: "text", text: "test5" }
  ];

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: bodyParameters
        }
      ]
    }
  };

  try {
    console.log(`Sending template "${templateName}" to ${to}`);
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    console.log("Template send response:", JSON.stringify(resp.data, null, 2));
  } catch (err) {
    console.error("Error sending template:", err.response?.data || err.message);
  }
}

// ✅ Webhook endpoint
app.post("/webhook", async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];
  const from = message?.from;

  if (message?.type === "text") {
    // Step 1 → Send language selection template
    await sendTemplate(from, "language_selection", "en_US");
  } else if (message?.type === "button") {
    const buttonText = message.button?.text?.toLowerCase();

    if (buttonText.includes("confirm")) {
      // Step 2a → Send confirmation template with hardcoded params
      await sendTemplate(from, "confirm_template", "en_US");
    } else if (buttonText.includes("reschedule")) {
      // Step 2b → Send reschedule template with hardcoded params
      await sendTemplate(from, "reschedule_template", "en_US");
    }
  }

  res.sendStatus(200);
});

// ✅ WhatsApp webhook verification
app.get("/webhook", (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verify_token) {
      console.log("Webhook verified");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.listen(3000, () => console.log("Webhook server is running on port 3000"));
