import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch"; // Needed to send messages via WhatsApp Cloud API

const app = express();
app.use(bodyParser.json());

// ✅ Replace with your actual verify token (same as in Meta webhook setup)
const VERIFY_TOKEN = "abc123shubdham"; 

// ✅ Replace with your actual WhatsApp Cloud API Access Token
const ACCESS_TOKEN = "EAAO4XijEvhMBPLJLmLXHf5WbaG9Ye37z8ayfi5wfSN9o6F48m6adfwdRfADWKbqttBZB1qMRczjsBJXH3WHzPeZCeIWNCRlLrtoaEyucQdijtLT6qYZCdY6TgRkOABKLxUztZCeWaxRL4WFvGoJXqexoI1utIEvhr3zr909bPLrq0XgZAj25xiRhBSPk4LxvOhQg9utWbJ7LF4jjdhrMzhQ4PqpfpWkXQZCJDTpaj0gKBQdwZDZD"; 

// ✅ Replace with your actual Phone Number ID from WhatsApp Cloud API
const PHONE_NUMBER_ID = "695311820339259"; 

// ✅ Your template name
const TEMPLATE_NAME = "language_selection"; 

// Webhook verification (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook event receiver (POST)
app.post("/webhook", async (req, res) => {
  console.log("Webhook received:", JSON.stringify(req.body, null, 2));

  // Check if there's a message
  if (
    req.body.object &&
    req.body.entry &&
    req.body.entry[0].changes &&
    req.body.entry[0].changes[0].value.messages &&
    req.body.entry[0].changes[0].value.messages[0]
  ) {
    const phoneNumber = req.body.entry[0].changes[0].value.messages[0].from; // sender's phone number

    // Send template message back
    await sendTemplateMessage(phoneNumber);
  }

  res.sendStatus(200);
});

// Function to send a template message
async function sendTemplateMessage(to) {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: "en_US" } // ✅ change if your template language is different
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Message sent:", data);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Home route
app.get("/", (req, res) => {
  res.send("WhatsApp bot is running 🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
