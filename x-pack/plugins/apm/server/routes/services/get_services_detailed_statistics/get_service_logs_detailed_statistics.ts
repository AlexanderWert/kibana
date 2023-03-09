/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { kqlQuery, rangeQuery } from '@kbn/observability-plugin/server';
import { keyBy } from 'lodash';
import { ProcessorEvent } from '@kbn/observability-plugin/common';
import { ApmServiceTransactionDocumentType } from '../../../../common/document_type';
import { RollupInterval } from '../../../../common/rollup';
import { getOffsetInMs } from '../../../../common/utils/get_offset_in_ms';
import { calculateThroughputWithInterval } from '../../../lib/helpers/calculate_throughput';
import { APMEventClient } from '../../../lib/helpers/create_es_client/create_apm_event_client';
import { RandomSampler } from '../../../lib/helpers/get_random_sampler';

import { withApmSpan } from '../../../utils/with_apm_span';

export async function getServiceLogsDetailedStats({
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
  const { offsetInMs, startWithOffset, endWithOffset } = getOffsetInMs({
    start,
    end,
    offset,
  });

  const response = await apmEventClient.searchLogs(
    'get_service_logs_detail_stats',
    {
      apm: {
        events: [ProcessorEvent.metric],
      },
      body: {
        track_total_hits: false,
        size: 0,
        query: {
          bool: {
            filter: [
              {
                terms: {
                  derived_service_name: services.map(
                    ({ serviceName }) => serviceName
                  ),
                },
              },
              ...rangeQuery(startWithOffset, endWithOffset),
              ...kqlQuery(kuery),
            ],
          },
        },
        runtime_mappings: {
          derived_service_name: {
            type: 'keyword',
            script: `if (doc.containsKey('service.name') && !doc['service.name'].empty) {
              emit(doc['service.name'].value);
            } else if (!doc['kubernetes.labels.app_kubernetes_io/name.keyword'].empty) {
              emit(doc['kubernetes.labels.app_kubernetes_io/name.keyword'].value);
            } else if (!doc['kubernetes.container.name.keyword'].empty) {
              emit(doc['kubernetes.container.name.keyword'].value);
            }`,
          },
        },
        aggs: {
          sample: {
            random_sampler: randomSampler,
            aggs: {
              agg_services: {
                terms: {
                  field: 'derived_service_name',
                  size: services.length,
                },
                aggs: {
                  timeseries: {
                    date_histogram: {
                      field: '@timestamp',
                      fixed_interval: `${bucketSizeInSeconds}s`,
                      min_doc_count: 0,
                      extended_bounds: {
                        min: startWithOffset,
                        max: endWithOffset,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  );

  return keyBy(
    response.aggregations?.sample.agg_services.buckets.map((bucket) => {
      return {
        serviceName: bucket.key as string,
        logRate: bucket.timeseries.buckets.map((dateBucket) => ({
          x: dateBucket.key + offsetInMs,
          y: calculateThroughputWithInterval({
            bucketSize: bucketSizeInSeconds,
            value: dateBucket.doc_count,
          }),
        })),
      };
    }) ?? [],
    'serviceName'
  );
}

export async function getServiceDetailedStatsPeriodsForLogsServices({
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
  if (services.length === 0) {
    return { currentPeriod: {}, previousPeriod: {} };
  }
  return withApmSpan('get_service_detailed_statistics', async () => {
    const commonProps = {
      services: services.filter((service) => service.isLogsOnly),
      environment,
      kuery,
      apmEventClient,
      documentType,
      rollupInterval,
      bucketSizeInSeconds,
      start,
      end,
      randomSampler,
    };

    const [currentPeriod, previousPeriod] = await Promise.all([
      getServiceLogsDetailedStats(commonProps),
      offset
        ? getServiceLogsDetailedStats({
            ...commonProps,
            offset,
          })
        : Promise.resolve({}),
    ]);

    return { currentPeriod, previousPeriod };
  });
}
