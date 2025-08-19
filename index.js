import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Webhook verification (Meta calls this once)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request:", req.query);

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages
app.post("/webhook", (req, res) => {
  console.log("📩 Incoming webhook:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from; // user’s phone number
      const text = message.text?.body;
      console.log(`👉 Message from ${from}: ${text}`);

      // Reply with a plain text message (no template)
      axios.post(
        `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: "Hello 👋 thanks for your message!" },
        },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
      ).then(r => console.log("✅ Reply sent:", r.data))
       .catch(err => console.error("❌ Error sending reply:", err.response?.data || err.message));
    }
  } catch (err) {
    console.error("⚠️ Webhook processing error:", err);
  }
});

app.listen(10000, () => console.log("🚀 Webhook server running on port 10000"));
