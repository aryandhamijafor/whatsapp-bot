import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(bodyParser.json());

const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;

// webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verifyToken) {
    console.log("Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// incoming messages
app.post("/webhook", async (req, res) => {
  console.log("Webhook payload:", JSON.stringify(req.body, null, 2));

  if (
    req.body.object === "whatsapp_business_account" &&
    req.body.entry?.[0]?.changes?.[0]?.value?.messages
  ) {
    const message = req.body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    const text = message.text?.body;

    console.log(`Incoming from ${from}: ${text}`);

    try {
      const phoneNumberId =
        req.body.entry[0].changes[0].value.metadata.phone_number_id;

      const templateResponse = await axios.post(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: "Hello, this is a test reply!" },
        },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Template send response:", templateResponse.data);
    } catch (error) {
      console.error(
        "Template send response:",
        error.response?.data || error.message
      );
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
