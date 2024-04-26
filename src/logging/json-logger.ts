import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { TxServiceEvent } from '../routes/events/event.dto';

interface JsonEventMessage {
  message: string;
  event: TxServiceEvent;
}

function isJsonEventMessage(message: unknown): message is JsonEventMessage {
  const messageCasted = message as JsonEventMessage;
  return (
    messageCasted.message !== undefined && messageCasted.message !== undefined
  );
}

export class JsonConsoleLogger extends ConsoleLogger {
  protected formatPid(pid: number) {
    return `${pid}`;
  }

  protected formatContext(context: string): string {
    return context;
  }

  protected colorize(
    message: string, // logLevel: LogLevel
  ) {
    return message;
  }

  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    // timestampDiff: string,
  ): string {
    const timestamp = Date.now();
    const dateAsString = new Date(timestamp).toISOString();
    const logJson: any = {
      timestamp: dateAsString,
      context: contextMessage,
      level: logLevel,
    };
    if (isJsonEventMessage(message)) {
      logJson.message = message.message;
      logJson.event = message.event;
    } else {
      logJson.message = this.stringifyMessage(message, logLevel);
    }

    return `${JSON.stringify(logJson)}\n`;
  }
}
