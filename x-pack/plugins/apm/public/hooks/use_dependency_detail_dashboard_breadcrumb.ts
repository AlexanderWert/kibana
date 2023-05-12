/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import { useBreadcrumb } from '../context/breadcrumbs/use_breadcrumb';
import { useAnyOfApmParams } from './use_apm_params';
import { useApmRouter } from './use_apm_router';

export function useDependencyDetailDashboardBreadcrumb() {
  const {
    query: {
      dependencyName,
      rangeFrom,
      rangeTo,
      refreshInterval,
      refreshPaused,
      environment,
      kuery,
      comparisonEnabled,
    },
  } = useAnyOfApmParams('/dependencies/dashboard');

  const apmRouter = useApmRouter();

  useBreadcrumb(
    () => [
      {
        title: i18n.translate(
          'xpack.apm.dependencyDetailDashboard.breadcrumbTitle',
          { defaultMessage: 'Dashboard' }
        ),
        href: apmRouter.link('/dependencies/dashboard', {
          query: {
            dependencyName,
            rangeFrom,
            rangeTo,
            refreshInterval,
            refreshPaused,
            environment,
            kuery,
            comparisonEnabled,
          },
        }),
      },
    ],
    [
      apmRouter,
      comparisonEnabled,
      dependencyName,
      environment,
      kuery,
      rangeFrom,
      rangeTo,
      refreshInterval,
      refreshPaused,
    ]
  );
}
