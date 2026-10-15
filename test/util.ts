import { connect as amqplibConnect, ChannelModel } from 'amqplib';

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
  const conn: ChannelModel = await amqplibConnect(amqpUrl);
  const channel = await conn.createChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  // Make sure queue exists, as this function can be called before subscribing. It
  // must be bound to the exchange already, or the message is dropped
  await channel.assertQueue(queue, { durable: true });
  const isMessagePublished = channel.publish(
    exchange,
    // Same format as the Transaction Service, `{chainId}.{type}.{address}`
    '1.TEST.0x0',
    Buffer.from(JSON.stringify(msg)),
  );
  await channel.close();
  await conn.close();
  return isMessagePublished;
}
