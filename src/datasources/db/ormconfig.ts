import { DataSource } from 'typeorm';
import { dataSourceOptions } from './database.options';

export const datasource = new DataSource(dataSourceOptions);
