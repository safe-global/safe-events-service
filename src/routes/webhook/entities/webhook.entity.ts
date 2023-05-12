import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Webhook{
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column()
  description: string;

  @Column({ default: true })
  isActive: boolean;
}