import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ENV variables from Render
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Root route
app.get("/", (req, res) => {
  res.send("✅ WhatsApp bot is working");
});

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// Webhook message handler
app.post("/webhook", async (req, res) => {
  console.log("📩 Incoming:", JSON.stringify(req.body, null, 2));

  if (req.body.object) {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from; // user number
      console.log(`👉 Received message from ${from}:`, msg);

      // reply with plain text
      try {
        const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: {
              body: "Hi 👋, I received your message.",
            },
          }),
        });

        const data = await response.json();
        console.log("📤 Reply sent:", JSON.stringify(data, null, 2));
      } catch (err) {
        console.error("❌ Error sending message:", err);
      }
    }
  }

  res.sendStatus(200);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
