import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Send a template message
async function sendTemplate(to, templateName) {
  try {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" }
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    console.log(`✅ Template '${templateName}' sent to ${to}`, response.data);
  } catch (error) {
    console.error(`❌ Error sending template '${templateName}':`, error.response?.data || error.message);
  }
}

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Handle webhook events
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object) {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const from = message.from; // sender's phone number

        // If it's a button reply
        if (message.type === "button") {
          const buttonText = message.button?.text;
          console.log(`📌 Button clicked: ${buttonText}`);

          if (buttonText === "Confirm") {
            await sendTemplate(from, "hello_world");
          } else if (buttonText === "Reschedule") {
            await sendTemplate(from, "track_my_order_test");
          } else {
            console.log("⚠️ Unknown button text received");
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.sendStatus(500);
  }
});

// Start server
app.listen(3000, () => {
  console.log("🚀 Server is running on port 3000");
});
