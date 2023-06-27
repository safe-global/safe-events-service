import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTimeMs: number = performance.now();

    res.on('finish', () => {
      const responseTimeMs = (performance.now() - startTimeMs).toFixed(0);
      const { method } = req;
      const { url, path } = req.route;
      const { statusCode } = res;
      this.logger.log(
        `MT::${method}::${url}::${responseTimeMs}::${statusCode}::${path}`,
      );
    });

    // Ends middleware function execution, hence allowing to move on
    if (next) {
      next();
    }
  }
}
