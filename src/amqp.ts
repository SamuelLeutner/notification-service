import { QUEUES } from "./constants/queues";
import amqplib, { Connection, Channel, ConsumeMessage } from "amqplib";

let channel: Channel;
let connection: Connection;

export async function initRabbitMQ() {
  connection = await amqplib.connect(process.env.RABBITMQ_URL!);
  channel = await connection.createChannel();

  channel.prefetch(10);

  for (const queue of Object.values(QUEUES)) {
    await channel.assertQueue(queue, { durable: true });
  }

  console.log("RabbitMQ connected and queues asserted.");
}

export async function publishToQueue<T>(queue: string, message: T) {
  if (!channel) throw new Error("Channel is not initialized");
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
}

export async function consumeFromQueue<T>(queue: string, dlq: string, onMessage: (msg: T) => Promise<void>) {
  if (!channel) throw new Error("Channel is not initialized");

  channel.consume(queue, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    try {
      const content: T = JSON.parse(msg.content.toString());
      await onMessage(content);
      channel.ack(msg);
    } catch (err) {
      console.error(`Failed processing message in ${queue}:`, err);
      channel.sendToQueue(dlq, msg.content, { persistent: true });
      channel.ack(msg);
    }
  });
}
