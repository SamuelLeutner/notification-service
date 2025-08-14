import { config } from "dotenv";
import { Elysia } from "elysia";
import { sendEmail } from "./email";
import { QUEUES } from "./constants/queues";
import type { WSMessage } from "./interfaces/ws_message";
import { broadcastWS, setupWebSocket } from "./websocket";
import type { EmailMessage } from "./interfaces/email_message";
import { initRabbitMQ, publishToQueue, consumeFromQueue } from "./amqp";
import type { NotificationMessage } from "./interfaces/notification_message";

config();
const app = new Elysia();

setupWebSocket(app);

app.listen({ port: 3000, hostname: "0.0.0.0" }, async () => {
  console.log("Notification Microservice running on port 3000.");

  await initRabbitMQ();

  await consumeFromQueue<NotificationMessage>(QUEUES.WS_NOTIFICATIONS, QUEUES.WS_DLQ,
    async (msg) => {
      await publishToQueue<EmailMessage>(QUEUES.EMAIL_QUEUE, {
        email: msg.email,
        subject: msg.subject,
        body: msg.message,
      });

      await publishToQueue<WSMessage>(QUEUES.WS_QUEUE, { type: "notification", payload: msg });
    }
  );

  await consumeFromQueue<EmailMessage>(QUEUES.EMAIL_QUEUE, QUEUES.EMAIL_DLQ,
    async (msg) => {
      await sendEmail(msg.email, msg.subject, msg.body);
    }
  );

  await consumeFromQueue<WSMessage>(QUEUES.WS_QUEUE, QUEUES.WS_DLQ,
    async (msg) => {
      broadcastWS(app, msg);
    }
  );
});

app.post("/test-notification", async ({ body }) => {
  const { email, subject, message } = body as NotificationMessage;

  await publishToQueue<EmailMessage>(QUEUES.EMAIL_QUEUE, { email, subject, body: message });
  await publishToQueue<WSMessage>(QUEUES.WS_QUEUE, { type: "notification", payload: { email, subject, message } });

  return { status: "queued" };
});
