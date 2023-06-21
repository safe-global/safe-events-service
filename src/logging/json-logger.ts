import { ConsoleLogger, LogLevel } from '@nestjs/common';

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
    const output = this.stringifyMessage(message, logLevel);
    const timestamp = Date.now();
    const dateAsString = new Date(timestamp).toISOString();
    const logJson = {
      timestamp: dateAsString,
      context: contextMessage,
      level: logLevel,
      message: output,
    };
    return `${JSON.stringify(logJson)}\n`;
  }
}
