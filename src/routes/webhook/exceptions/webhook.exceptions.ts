import { HttpException } from '@nestjs/common';

export class WebhookAlreadyExists extends HttpException {
  constructor() {
    super('Webhook already exists', 422);
  }
}

export class WebhookDoesNotExist extends HttpException {
  constructor() {
    super('Webhook does not exist', 404);
  }
}
