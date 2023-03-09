/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { kqlQuery, rangeQuery } from '@kbn/observability-plugin/server';
import { ProcessorEvent } from '@kbn/observability-plugin/common';

import { getOffsetInMs } from '../../../common/utils/get_offset_in_ms';
import { getBucketSizeForAggregatedTransactions } from '../../lib/helpers/get_bucket_size_for_aggregated_transactions';
import { APMEventClient } from '../../lib/helpers/create_es_client/create_apm_event_client';

interface Options {
  environment: string;
  kuery: string;
  serviceName: string;
  serviceNameField: string;
  apmEventClient: APMEventClient;
  start: number;
  end: number;
  offset?: string;
}

export async function getLogRate({
  environment,
  kuery,
  serviceName,
  serviceNameField,
  apmEventClient,
  start,
  end,
  offset,
}: Options) {
  const { startWithOffset, endWithOffset } = getOffsetInMs({
    start,
    end,
    offset,
  });

  const { intervalString } = getBucketSizeForAggregatedTransactions({
    start: startWithOffset,
    end: endWithOffset,
  });

  const params = {
    apm: {
      events: [ProcessorEvent.metric],
    },
    body: {
      track_total_hits: false,
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { [serviceNameField]: serviceName } },
            ...rangeQuery(startWithOffset, endWithOffset),
            ...kqlQuery(kuery),
          ],
        },
      },
      aggs: {
        ts: {
          date_histogram: {
            field: '@timestamp',
            fixed_interval: intervalString,
            min_doc_count: 0,
            extended_bounds: { min: startWithOffset, max: endWithOffset },
          },
          aggs: {
            lograte: {
              rate: { unit: 'minute' as const },
            },
            levels: {
              terms: { field: 'log.level.keyword' },
            },
          },
        },
        level_breakdown: {
          terms: { field: 'log.level.keyword' },
        },
      },
    },
  };

  const response = await apmEventClient.searchLogs(
    'get_lograte_for_service',
    params
  );

  const overall =
    response.aggregations?.ts.buckets.map((bucket) => {
      return {
        x: bucket.key,
        y: bucket.lograte.value,
      };
    }) ?? [];

  const perLevel =
    response.aggregations?.level_breakdown.buckets.map((levelBucket) => {
      const level = (levelBucket.key as string).toLowerCase();
      return {
        level,
        timeseries:
          response.aggregations?.ts.buckets.map((bucket) => {
            const bucketCount = bucket.doc_count;
            return {
              x: bucket.key,
              y:
                ((bucket.levels.buckets.find((b) => b.key === levelBucket.key)
                  ?.doc_count ?? 0) *
                  100) /
                bucketCount,
            };
          }) ?? [],
      };
    }) ?? [];

  return {
    timeseries: overall,
    perLevel,
  };
}
