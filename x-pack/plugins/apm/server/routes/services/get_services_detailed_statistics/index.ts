/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ApmServiceTransactionDocumentType } from '../../../../common/document_type';
import { RollupInterval } from '../../../../common/rollup';
import { APMEventClient } from '../../../lib/helpers/create_es_client/create_apm_event_client';
import { RandomSampler } from '../../../lib/helpers/get_random_sampler';
import { getServiceDetailedStatsPeriods } from './get_service_transaction_detailed_statistics';
import { getServiceDetailedStatsPeriodsForLogsServices } from './get_service_logs_detailed_statistics';

export async function getServicesDetailedStatistics({
  services,
  environment,
  kuery,
  apmEventClient,
  documentType,
  rollupInterval,
  bucketSizeInSeconds,
  offset,
  start,
  end,
  randomSampler,
}: {
  services: Array<{
    serviceName: string;
    isLogsOnly: boolean;
  }>;
  environment: string;
  kuery: string;
  apmEventClient: APMEventClient;
  documentType: ApmServiceTransactionDocumentType;
  rollupInterval: RollupInterval;
  bucketSizeInSeconds: number;
  offset?: string;
  start: number;
  end: number;
  randomSampler: RandomSampler;
}) {
  const apmServiceNames = services
    .filter((service) => !service.isLogsOnly)
    .map(({ serviceName }) => serviceName);

  const transactionBasedDetails = getServiceDetailedStatsPeriods({
    serviceNames: apmServiceNames,
    environment,
    kuery,
    apmEventClient,
    start,
    end,
    randomSampler,
    offset,
    documentType,
    rollupInterval,
    bucketSizeInSeconds,
  });

  const logsOnlyServices = services.filter((service) => service.isLogsOnly);

  if (logsOnlyServices.length === 0) {
    return transactionBasedDetails;
  }

  const logsBasedDetails = getServiceDetailedStatsPeriodsForLogsServices({
    services: logsOnlyServices,
    environment,
    kuery,
    apmEventClient,
    start,
    end,
    randomSampler,
    offset,
    documentType,
    rollupInterval,
    bucketSizeInSeconds,
  });

  const combinedResult = Promise.all([
    transactionBasedDetails,
    logsBasedDetails,
  ]).then(([txDetails, logsDetails]) => {
    return {
      currentPeriod: {
        ...txDetails.currentPeriod,
        ...logsDetails.currentPeriod,
      },
      previousPeriod: {
        ...txDetails.previousPeriod,
        ...logsDetails.previousPeriod,
      },
    };
  });
  return combinedResult;
}
