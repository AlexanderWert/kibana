/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { kqlQuery, rangeQuery } from '@kbn/observability-plugin/server';
import { ProcessorEvent } from '@kbn/observability-plugin/common';
import { environmentQuery } from '../../../../common/utils/environment_query';
import { APMEventClient } from '../../../lib/helpers/create_es_client/create_apm_event_client';
import { calculateThroughputWithRange } from '../../../lib/helpers/calculate_throughput';

export async function getServicesFromLogs({
  environment,
  apmEventClient,
  maxNumServices,
  kuery,
  start,
  end,
}: {
  apmEventClient: APMEventClient;
  environment: string;
  maxNumServices: number;
  kuery: string;
  start: number;
  end: number;
}) {
  const response = await apmEventClient.searchLogs('get_services_from_logs', {
    apm: {
      events: [ProcessorEvent.metric],
    },
    body: {
      track_total_hits: false,
      size: 0,
      query: {
        bool: {
          filter: [
            ...rangeQuery(start, end),
            ...environmentQuery(environment),
            ...kqlQuery(kuery),
          ],
        },
      },
      runtime_mappings: {
        derived_service_name: {
          type: 'keyword',
          script: `if (doc.containsKey('service.name') && !doc['service.name'].empty) {
            emit(doc['service.name'].value);
          } else if (doc.containsKey('kubernetes.labels.app_kubernetes_io/name.keyword') && !doc['kubernetes.labels.app_kubernetes_io/name.keyword'].empty) {
            emit(doc['kubernetes.labels.app_kubernetes_io/name.keyword'].value);
          } else if (doc.containsKey('kubernetes.container.name.keyword') && !doc['kubernetes.container.name.keyword'].empty) {
            emit(doc['kubernetes.container.name.keyword'].value);
          } else if (doc.containsKey('aws.cloudwatch.log_group') && !doc['aws.cloudwatch.log_group'].empty) {
            emit(doc['aws.cloudwatch.log_group'].value);
          }`,
        },
        service_name_field: {
          type: 'keyword',
          script: `
            if (doc.containsKey('service.name') && !doc['service.name'].empty) {
              emit('service.name');
            } else if (doc.containsKey('kubernetes.labels.app_kubernetes_io/name.keyword') && !doc['kubernetes.labels.app_kubernetes_io/name.keyword'].empty) {
              emit('kubernetes.labels.app_kubernetes_io/name.keyword');
            } else if (doc.containsKey('kubernetes.container.name.keyword') && !doc['kubernetes.container.name.keyword'].empty) {
              emit('kubernetes.container.name.keyword');
            } else if (doc.containsKey('aws.cloudwatch.log_group') && !doc['aws.cloudwatch.log_group'].empty) {
              emit('aws.cloudwatch.log_group');
            }
          `,
        },
      },
      aggs: {
        app: {
          terms: {
            field: 'derived_service_name',
            size: maxNumServices,
          },
          aggs: {
            logs: {
              top_hits: {
                size: 1,
                _source: false,
                fields: ['service_name_field'],
              },
            },
          },
        },
      },
    },
  });

  return {
    services:
      response.aggregations?.app.buckets.map((bucket) => {
        return {
          serviceName: bucket.key as string,
          serviceNameField: bucket.logs.hits.hits[0]?.fields
            .service_name_field as unknown as string,
          isLogsOnly: true,
          logRate: calculateThroughputWithRange({
            start,
            end,
            value: bucket.doc_count,
          }),
        };
      }) ?? [],
    maxServiceCountExceeded: false,
  };
}
