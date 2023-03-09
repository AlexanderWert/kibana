/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';

import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { ChartPointerEventContextProvider } from '../../../context/chart_pointer_event/chart_pointer_event_context';
import { ServiceOverviewLogRateChart } from './service_overview_log_rate_chart';
import { ServiceOverviewLogLevelBreakdown } from './service_overview_log_level_breakdown';
import { useApmParams } from '../../../hooks/use_apm_params';

export function LogsBasedOverview({
  serviceNameField,
}: {
  serviceNameField: string;
}) {
  const {
    query: { kuery },
  } = useApmParams('/services/{serviceName}/overview');

  return (
    <ChartPointerEventContextProvider>
      <EuiFlexGroup direction="column" gutterSize="s">
        <EuiFlexItem>
          <ServiceOverviewLogRateChart
            serviceNameField={serviceNameField}
            height={200}
            kuery={kuery}
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <ServiceOverviewLogLevelBreakdown
            serviceNameField={serviceNameField}
            height={200}
            kuery={kuery}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </ChartPointerEventContextProvider>
  );
}
