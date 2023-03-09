/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { AgentName } from '../typings/es_schemas/ui/fields/agent';
import { ServiceHealthStatus } from './service_health_status';

export interface ServiceListItem {
  serviceName: string;
  serviceNameField?: string;
  healthStatus?: ServiceHealthStatus;
  transactionType?: string;
  agentName?: AgentName;
  throughput?: number;
  latency?: number | null;
  transactionErrorRate?: number | null;
  environments?: string[];
  alertsCount?: number;
  overflowCount?: number | null;
  isLogsOnly?: boolean;
  logRate?: number;
}

export enum ServiceInventoryFieldName {
  ServiceName = 'serviceName',
  Data = 'data',
  HealthStatus = 'healthStatus',
  Environments = 'environments',
  TransactionType = 'transactionType',
  Throughput = 'throughput',
  LogRate = 'logRate',
  Latency = 'latency',
  TransactionErrorRate = 'transactionErrorRate',
  AlertsCount = 'alertsCount',
}
