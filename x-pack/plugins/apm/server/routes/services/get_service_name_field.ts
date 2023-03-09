/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { rangeQuery } from '@kbn/observability-plugin/server';
import { ProcessorEvent } from '@kbn/observability-plugin/common';
import { APMEventClient } from '../../lib/helpers/create_es_client/create_apm_event_client';

export async function getServiceNameField({
  serviceName,
  apmEventClient,
  start,
  end,
}: {
  serviceName: string;
  apmEventClient: APMEventClient;
  start: number;
  end: number;
}) {
  const response = await apmEventClient.searchLogs('get_services_from_logs', {
    apm: {
      events: [ProcessorEvent.metric],
    },
    body: {
      track_total_hits: 1,
      size: 1,
      query: {
        bool: {
          filter: [
            { term: { derived_service_name: serviceName } },
            ...rangeQuery(start, end),
          ],
        },
      },
      fields: ['service_name_field'],
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
            if (doc.containsKey('service.name') && !doc['service.name'].empty && doc['service.name'].value == '${serviceName}') {
              emit('service.name');
            } else if (doc.containsKey('kubernetes.labels.app_kubernetes_io/name.keyword') && !doc['kubernetes.labels.app_kubernetes_io/name.keyword'].empty && doc['kubernetes.labels.app_kubernetes_io/name.keyword'].value == '${serviceName}') {
              emit('kubernetes.labels.app_kubernetes_io/name.keyword');
            } else if (doc.containsKey('kubernetes.container.name.keyword') && !doc['kubernetes.container.name.keyword'].empty && doc['kubernetes.container.name.keyword'].value == '${serviceName}') {
              emit('kubernetes.container.name.keyword');
            } else if (doc.containsKey('aws.cloudwatch.log_group') && !doc['aws.cloudwatch.log_group'].empty && doc['aws.cloudwatch.log_group'].value == '${serviceName}') {
              emit('aws.cloudwatch.log_group');
            }
          `,
        },
      },
    },
  });

  if (response.hits.total.value === 0) {
    return {};
  }

  const x = response.hits.hits[0]?.fields.service_name_field;

  const serviceNameField = x && x.length > 0 ? (x[0] as string) : undefined;

  return {
    serviceNameField,
  };
}
