/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiPanel,
  EuiTitle,
  EuiIconTip,
  EuiFlexItem,
  EuiFlexGroup,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import React from 'react';
import { euiPaletteColorBlind } from '@elastic/eui';
import { isTimeComparison } from '../../shared/time_comparison/get_comparison_options';
import { ApmMlDetectorType } from '../../../../common/anomaly_detection/apm_ml_detectors';
import { asExactTransactionRate } from '../../../../common/utils/formatters';
import { useApmServiceContext } from '../../../context/apm_service/use_apm_service_context';
import { useEnvironmentsContext } from '../../../context/environments_context/use_environments_context';
import { useAnyOfApmParams } from '../../../hooks/use_apm_params';
import { useFetcher } from '../../../hooks/use_fetcher';
import { usePreferredServiceAnomalyTimeseries } from '../../../hooks/use_preferred_service_anomaly_timeseries';
import { useTimeRange } from '../../../hooks/use_time_range';
import { TimeseriesChartWithContext } from '../../shared/charts/timeseries_chart_with_context';
import { getComparisonChartTheme } from '../../shared/time_comparison/get_comparison_chart_theme';

const palette = euiPaletteColorBlind({ rotations: 2 });
const INITIAL_STATE = {
  timeseries: [],
  perLevel: [],
};

export function ServiceOverviewLogRateChart({
  height,
  kuery,
  serviceNameField,
}: {
  height?: number;
  kuery: string;
  serviceNameField: string;
}) {
  const {
    query: { rangeFrom, rangeTo, comparisonEnabled, offset },
  } = useAnyOfApmParams(
    '/services/{serviceName}',
    '/mobile-services/{serviceName}'
  );

  const { environment } = useEnvironmentsContext();

  const preferredAnomalyTimeseries = usePreferredServiceAnomalyTimeseries(
    ApmMlDetectorType.txThroughput
  );

  const { start, end } = useTimeRange({ rangeFrom, rangeTo });

  const { serviceName } = useApmServiceContext();

  const comparisonChartTheme = getComparisonChartTheme();

  const { data = INITIAL_STATE, status } = useFetcher(
    (callApmApi) => {
      if (serviceName && serviceNameField && start && end) {
        return callApmApi('GET /internal/apm/services/{serviceName}/lograte', {
          params: {
            path: {
              serviceName,
            },
            query: {
              environment,
              kuery,
              start,
              end,
              serviceNameField,
              offset:
                comparisonEnabled && isTimeComparison(offset)
                  ? offset
                  : undefined,
            },
          },
        });
      }
    },
    [
      environment,
      kuery,
      serviceName,
      start,
      end,
      serviceNameField,
      offset,
      comparisonEnabled,
    ]
  );

  const timeseries = [
    {
      data: data.timeseries,
      type: 'linemark',
      color: palette[0],
      title: i18n.translate('xpack.apm.serviceOverview.throughtputChartTitle', {
        defaultMessage: 'Log Rate',
      }),
    },
  ];

  return (
    <EuiPanel hasBorder={true}>
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs">
            <h2>
              {i18n.translate(
                'xpack.apm.serviceOverview.throughtputChartTitle',
                { defaultMessage: 'Log rate' }
              )}
            </h2>
          </EuiTitle>
        </EuiFlexItem>

        <EuiFlexItem grow={false}>
          <EuiIconTip
            content={i18n.translate('xpack.apm.serviceOverview.tpmHelp', {
              defaultMessage: 'Log rate is measured in logs per minute (lpm).',
            })}
            position="right"
          />
        </EuiFlexItem>
      </EuiFlexGroup>

      <TimeseriesChartWithContext
        id="lograte"
        height={height}
        showAnnotations={false}
        fetchStatus={status}
        timeseries={timeseries}
        yLabelFormat={asExactTransactionRate}
        customTheme={comparisonChartTheme}
      />
    </EuiPanel>
  );
}
