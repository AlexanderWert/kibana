/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState } from 'react';
import {
  AwaitingDashboardAPI,
  DashboardRenderer,
} from '@kbn/dashboard-plugin/public';
import { buildPhraseFilter, Filter } from '@kbn/es-query';
import { ViewMode } from '@kbn/embeddable-plugin/public';
import { EuiTitle, EuiText, EuiSpacer, EuiPanel } from '@elastic/eui';
import { useKibana } from '@kbn/kibana-react-plugin/public';

import { ApmPluginStartDeps } from '../../../plugin';
import { useApmDataView } from '../../../hooks/use_apm_data_view';
import { useAnyOfApmParams } from '../../../hooks/use_apm_params';
import { useDependencyDetailDashboardBreadcrumb } from '../../../hooks/use_dependency_detail_dashboard_breadcrumb';
import DashboardPicker from '../../shared/dashboard_picker';

export function DependencyDetailDashboard() {
  const {
    services: { dashboard: dashService },
  } = useKibana<ApmPluginStartDeps>();
  const [dashboard, setDashboard] = useState<AwaitingDashboardAPI>();
  const { dataView } = useApmDataView();
  const [selectedDB, setSelectedDB] = useState<string>('NONE');

  const {
    query: { dependencyName, rangeFrom, rangeTo },
  } = useAnyOfApmParams('/dependencies/dashboard');

  // add a filter debugger panel as soon as the dashboard becomes available
  useEffect(() => {
    if (!dashboard) return;
    (async () => {
      if (dataView) {
        const field = dataView.getFieldByName(
          'span.destination.service.resource'
        );
        if (field) {
          const filter: Filter = buildPhraseFilter(
            field,
            dependencyName,
            dataView
          );
          dashboard.updateInput({
            viewMode: ViewMode.VIEW,
            timeRange: { from: rangeFrom, to: rangeTo },
            filters: [filter],
          });
        }
      }
      dashboard.reload();
    })();
  }, [dataView, dashboard, rangeFrom, rangeTo, dependencyName]);

  useDependencyDetailDashboardBreadcrumb();

  const onSelectDashboard = async (db: { name: string; id: string } | null) => {
    const findDashboardService = await dashService?.findDashboardsService();
    const id = (await findDashboardService?.findByTitle('[Logs] Web Traffic'))
      ?.id;
    if (id) {
      setSelectedDB(id);
    }
  };

  return (
    <>
      <EuiTitle>
        <h2>Dashboard with controls example</h2>
      </EuiTitle>
      <EuiText>
        <p>
          A dashboard with a markdown panel that displays the filters from its
          control group. Selected Dashboard: {selectedDB}
        </p>
      </EuiText>
      <EuiSpacer size="m" />
      <EuiPanel hasBorder={true}>
        <DashboardRenderer
          savedObjectId="22379d80-eb4e-11ed-b3c6-95567bb3c2e5"
          getCreationOptions={async () => {
            // if (dashboard) {
            //   const dataView = dashboard.getAllDataViews()[0];
            //   const field = dataView.getFieldByName(
            //     'span.destination.service.resource'
            //   );
            //   if (field) {
            //     const filter: Filter = buildPhraseFilter(
            //       field,
            //       dependencyName,
            //       dataView
            //     );
            //     const cOpts: DashboardCreationOptions = {
            //       initialInput: {
            //         viewMode: ViewMode.VIEW,
            //         timeRange: { from: rangeFrom, to: rangeTo },
            //         filters: [filter],
            //       },
            //     };

            //     return cOpts;
            //   }
            // }
            return {
              initialInput: {
                viewMode: ViewMode.VIEW,
                timeRange: { from: rangeFrom, to: rangeTo },
              },
            };
          }}
          ref={setDashboard}
        />
        {/* <DashboardRenderer
          getCreationOptions={async () => {
            const builder = controlGroupInputBuilder;
            const controlGroupInput = getDefaultControlGroupInput();
            await builder.addDataControlFromField(controlGroupInput, {
              dataViewId: 'APM',
              title: 'Destintion country',
              fieldName: 'geo.dest',
              width: 'medium',
              grow: false,
            });
            await builder.addDataControlFromField(controlGroupInput, {
              dataViewId: 'APM',
              fieldName: 'bytes',
              width: 'medium',
              grow: true,
              title: 'Bytes',
            });

            return {
              useControlGroupIntegration: true,
              initialInput: {
                timeRange: { from: 'now-30d', to: 'now' },
                viewMode: ViewMode.VIEW,
                controlGroupInput,
              },
            };
          }}
          ref={setDashboard}
        /> */}
      </EuiPanel>
      <DashboardPicker isDisabled={false} onChange={onSelectDashboard} />
    </>
  );
}
