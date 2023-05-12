import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';

@Injectable()
export class WebhookService {
  constructor(
    @InjectRepository(Webhook)
    private WebHooksRepository: Repository<Webhook>,
  ) {}

  findAll(): Promise<Webhook[]> {
    return this.WebHooksRepository.find();
  }

  findOne(id: number): Promise<Webhook | null> {
    return this.WebHooksRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.WebHooksRepository.delete(id);
  }
}