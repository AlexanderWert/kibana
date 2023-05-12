/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import {
  AwaitingDashboardAPI,
  DashboardRenderer,
} from '@kbn/dashboard-plugin/public';

import { ViewMode } from '@kbn/embeddable-plugin/public';
import { buildPhraseFilter, Filter } from '@kbn/es-query';
import { DataView } from '@kbn/data-views-plugin/common';
import React, { useState, useEffect } from 'react';
import { useApmParams } from '../../../hooks/use_apm_params';
import { useApmServiceContext } from '../../../context/apm_service/use_apm_service_context';
import { DashboardSelection } from './dashboard_selection';
import { useApmDataView } from '../../../hooks/use_apm_data_view';

export function ServiceDashboardsView() {
  const [dashboard, setDashboard] = useState<AwaitingDashboardAPI>();
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>();

  const { dataView } = useApmDataView();
  const { serviceName } = useApmServiceContext();
  const {
    query: { kuery, rangeFrom, rangeTo },
  } = useApmParams('/services/{serviceName}/dashboards');

  useEffect(() => {
    if (!dashboard) return;
    dashboard.updateInput({
      viewMode: ViewMode.VIEW,
      timeRange: { from: rangeFrom, to: rangeTo },
      filters: dataView ? getFilters(serviceName, dataView) : [],
      query: { query: kuery, language: 'kuery' },
    });
  }, [kuery, serviceName, dataView, dashboard, rangeFrom, rangeTo]);

  return (
    <EuiFlexGroup direction="column">
      <DashboardSelection
        onSelectionChanged={(selection) =>
          setSelectedDashboardId(selection?.dashboardId)
        }
      />
      <EuiFlexItem>
        {selectedDashboardId && (
          <DashboardRenderer
            savedObjectId={selectedDashboardId}
            getCreationOptions={async () => {
              return {
                initialInput: {
                  viewMode: ViewMode.VIEW,
                  timeRange: { from: rangeFrom, to: rangeTo },
                  filters: dataView ? getFilters(serviceName, dataView) : [],
                  query: { query: kuery, language: 'kuery' },
                },
              };
            }}
            ref={setDashboard}
          />
        )}
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

function getFilters(serviceName: string, dataView: DataView): Filter[] {
  const serviceNameField = dataView.getFieldByName('service.name');
  if (serviceNameField) {
    const serviceNameFilter = buildPhraseFilter(
      serviceNameField,
      serviceName,
      dataView
    );
    return [serviceNameFilter];
  }

  return [];
}
