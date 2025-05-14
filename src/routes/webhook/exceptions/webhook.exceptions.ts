import { HttpException } from '@nestjs/common';

export class WebhookAlreadyExists extends HttpException {
  constructor(details?: string) {
    super('Webhook already exists' + (details ? `: ${details}` : ''), 422);
  }
}

export class WebhookDoesNotExist extends HttpException {
  constructor() {
    super('Webhook does not exist', 404);
  }
}
