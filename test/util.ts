import { connect as amqplibConnect, Connection } from 'amqplib';

/**
 * Publish given message to AMQP url provided
 * @param amqpUrl
 * @param exchange
 * @param queue
 * @param msg
 * @returns `true` if message is published, `false` otherwise
 */
export async function publishMessage(
  amqpUrl: string,
  exchange: string,
  queue: string,
  msg: object,
): Promise<boolean> {
  const conn: Connection = await amqplibConnect(amqpUrl);
  const channel = await conn.createChannel();
  await channel.assertExchange(exchange, 'fanout', { durable: true });
  // Make sure queue is binded to the exchange, as this function can be called before subscribing
  await channel.assertQueue(queue, { durable: true });
  const isMessagePublished = channel.publish(
    exchange,
    '',
    Buffer.from(JSON.stringify(msg)),
  );
  await channel.close();
  await conn.close();
  return isMessagePublished;
}
