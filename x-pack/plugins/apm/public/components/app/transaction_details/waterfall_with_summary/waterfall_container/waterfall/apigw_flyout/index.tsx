/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyoutHeader,
  EuiPortal,
  EuiTitle,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { LogStream } from '@kbn/infra-plugin/public';

import React from 'react';

import { ResponsiveFlyout } from '../responsive_flyout';

import { IWaterfallSpan } from '../waterfall_helpers/waterfall_helpers';

interface Props {
  span: IWaterfallSpan;
  totalDuration: number;
  timestamp: number;
  onClose: () => void;
}

export function ApiGwFlyout({
  span,
  totalDuration,
  timestamp,
  onClose,
}: Props) {
  const requestId = span.doc.labels?.aws_apigw_request_id;
  const startTimestamp = Math.floor(timestamp / 1000);
  const endTimestamp = Math.ceil(startTimestamp + totalDuration / 1000);
  const framePaddingMs = 1000 * 60 * 60 * 24; // 24 hours
  return (
    <EuiPortal>
      <ResponsiveFlyout onClose={onClose} size="m" ownFocus={true}>
        <EuiFlyoutHeader hasBorder>
          <EuiFlexGroup>
            <EuiFlexItem grow={false}>
              <EuiTitle>
                <h2>
                  {i18n.translate(
                    'xpack.apm.transactionDetails.spanFlyout.spanDetailsTitle',
                    { defaultMessage: 'AWS API Gateway Logs' }
                  )}
                </h2>
              </EuiTitle>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlyoutHeader>
        <LogStream
          logView={{ type: 'log-view-reference', logViewId: 'default' }}
          startTimestamp={startTimestamp - framePaddingMs}
          endTimestamp={endTimestamp + framePaddingMs}
          query={`aws.apigw.request.id:"${requestId}"`}
          height={640}
          columns={[
            { type: 'timestamp' },
            {
              type: 'field',
              field: 'service.name',
              header: i18n.translate(
                'xpack.apm.propertiesTable.tabs.logs.serviceName',
                { defaultMessage: 'Service Name' }
              ),
              width: 200,
            },
            { type: 'message' },
          ]}
          showFlyoutAction
        />
      </ResponsiveFlyout>
    </EuiPortal>
  );
}
