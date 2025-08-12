import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/webhook", async (req, res) => {
  console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      let messageText = "";

      if (msg.type === "text") {
        messageText = msg.text.body.trim();
      } else if (msg.type === "button") {
        messageText = msg.button.text.trim();
      }

      console.log(`Received message from ${from}: ${messageText}`);

      // Handle button flow
      if (messageText.toLowerCase() === "confirm") {
        await sendTemplate(from, "hello_world", "en_US");
      } else if (messageText.toLowerCase() === "reschedule") {
        await sendTemplate(from, "track_my_order_test", "en_US");
      } else {
        console.log("No matching action for:", messageText);
      }
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
  }

  res.sendStatus(200);
});

async function sendTemplate(to, templateName, languageCode) {
  try {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode }
      }
    };

    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    };

    console.log(`Sending template '${templateName}' to ${to}`);
    const response = await axios.post(url, payload, { headers });
    console.log("Template sent:", response.data);
  } catch (error) {
    console.error("Error sending template:", error.response?.data || error.message);
  }
}

app.listen(3000, () => {
  console.log("Webhook server is listening on port 3000");
});
