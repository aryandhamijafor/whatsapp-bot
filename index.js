import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Your WhatsApp API credentials
const token = "EAAO4XijEvhMBPDq76X1tdjJ1bZCZCztlIB3ZBeVZA0cwkZAkVeAFMmLRayMZB98igNOu9LPiuhJYGJkng5hJN0QpcpF6VTR8H22d7iYDtkQ1xhsKEPTMqAK41DaON6wAGigZCZBYftSvDsSlM9vWCpZC1H33F0K5N6ExuPvaNEAiwkbHdDeUnKgDjPJjkWiNDJEBMeBtlZCcuOZB1ATypdaTZB7cNwkibI0aoUm6kHyziVvuH7b0IwZDZD"; // Replace with your permanent access token
const phone_number_id = "695311820339259"; // Replace with your phone number ID

// Verify webhook (for initial setup in Meta)
app.get("/webhook", (req, res) => {
  const verify_token = "abc123shubdham"; // same token you set in WhatsApp Cloud API dashboard
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const tokenParam = req.query["hub.verify_token"];

  if (mode && tokenParam) {
    if (mode === "subscribe" && tokenParam === verify_token) {
      console.log("Webhook verified ✅");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Handle incoming messages
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook received:", JSON.stringify(req.body, null, 2));

    if (
      req.body.object &&
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      const message = req.body.entry[0].changes[0].value.messages[0];
      const from = message.from; // sender's WhatsApp number

      // Send a free-form text reply
      await sendTextMessage(from, "Hello! I got your message ✅");
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error in webhook processing:", error);
    res.sendStatus(500);
  }
});

// Function to send a free-form text message
async function sendTextMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${phone_number_id}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    text: { body: text }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("Message sent:", data);
}

// Start the Express server
app.listen(10000, () => {
  console.log("Webhook is listening on port 10000 🚀");
});
