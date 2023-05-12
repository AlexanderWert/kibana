/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiOverlayMask, EuiConfirmModal } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { MappedDashboardOption } from './add_dashboard_modal';
import { useApmPluginContext } from '../../../context/apm_plugin/use_apm_plugin_context';
import { useApmServiceContext } from '../../../context/apm_service/use_apm_service_context';
import { callApmApi } from '../../../services/rest/create_call_apm_api';

export function UnlinkDashboardModal({
  dashboardMapping,
  onUnlinked,
  onClose,
}: {
  dashboardMapping: MappedDashboardOption;
  onUnlinked?: (dashboardMapping: MappedDashboardOption) => void;
  onClose?: (dashboardMapping: MappedDashboardOption) => void;
}) {
  const {
    core: { notifications },
  } = useApmPluginContext();

  const { serviceName } = useApmServiceContext();

  const deleteDashboardMapping = async () => {
    try {
      await callApmApi('DELETE /internal/apm/services/dashboards', {
        params: {
          query: {
            dashboardMappingId: dashboardMapping.value,
          },
        },
        signal: null,
      });

      notifications.toasts.addSuccess(
        getUnlinkSuccessToastLabels(dashboardMapping)
      );
      if (onUnlinked) {
        onUnlinked(dashboardMapping);
      }
    } catch (error) {
      console.error(error);
      notifications.toasts.addDanger(
        getUnlinkFailureToastLabels(dashboardMapping, error)
      );
    }
  };

  const unlinkAndClose = async () => {
    deleteDashboardMapping();
    close();
  };

  const close = async () => {
    if (onClose) {
      onClose(dashboardMapping);
    }
  };

  return (
    <EuiOverlayMask>
      <EuiConfirmModal
        title="Unlink dashboard"
        onCancel={() => close()}
        onConfirm={unlinkAndClose}
        cancelButtonText="Cancel"
        confirmButtonText="Unlink"
        defaultFocusedButton="confirm"
      >
        <p>
          Are you sure you want to unlink dashboard
          <br />
          <b>
            &quot;
            {dashboardMapping.label}&quot;
          </b>
          <br />
          from service <br />
          <b>&quot;{serviceName}&quot;</b>?
        </p>
      </EuiConfirmModal>
    </EuiOverlayMask>
  );
}

function getUnlinkSuccessToastLabels({
  label: dashboardName,
}: MappedDashboardOption) {
  return {
    title: i18n.translate(
      'xpack.apm.serviceCustomDashboards.unlinkSucess.toast.title',
      {
        defaultMessage: 'Unlinked "{dashboardName}"',
        values: { dashboardName },
      }
    ),
    text: i18n.translate(
      'xpack.apm.serviceCustomDashboards.unlinkSucess.toast.text',
      {
        defaultMessage:
          'Dashboard "{dashboardName}" has been unlinked successfully.',
        values: { dashboardName },
      }
    ),
  };
}

function getUnlinkFailureToastLabels(
  { label: dashboardName }: MappedDashboardOption,
  error: Error & { body: { message: string } }
) {
  return {
    title: i18n.translate(
      'xpack.apm.serviceCustomDashboards.unlinkFailure.toast.title',
      {
        defaultMessage: 'Error while unlinking "{dashboardName}"',
        values: { dashboardName },
      }
    ),
    text: error.body.message,
  };
}
