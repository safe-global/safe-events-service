import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * Fields provided will be part of the messageContext field for the JSON log
 */
interface MessageContext {
  [otherProperties: string]: string;
}

/**
 * JSON log structure
 */
interface JsonEventMessage {
  message: string;
  messageContext: MessageContext;
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
    message: string | JsonEventMessage,
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
    if (typeof message === 'string') {
      logJson.message = this.stringifyMessage(message, logLevel);
    } else {
      logJson.message = message.message;
      logJson.messageContext = message.messageContext;
    }

    return `${JSON.stringify(logJson)}\n`;
  }
}
