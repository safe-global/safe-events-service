import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * All the fields provided will be part of the JSON log (instead of a stringified JSON)
 */
interface JsonEventMessage {
  message: string;
  [otherProperties: string]: unknown;
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
    let logJson: any = {
      timestamp: dateAsString,
      context: contextMessage,
      level: logLevel,
    };
    if (typeof message === 'string') {
      logJson.message = this.stringifyMessage(message, logLevel);
    } else {
      logJson = { ...logJson, ...message };
    }

    return `${JSON.stringify(logJson)}\n`;
  }
}
