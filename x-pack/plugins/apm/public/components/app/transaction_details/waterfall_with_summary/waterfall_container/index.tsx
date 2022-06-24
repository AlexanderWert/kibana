/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { keyBy } from 'lodash';
import { EuiFlexGroup } from '@elastic/eui';
import { EuiFlexItem } from '@elastic/eui';
import { EuiSwitch } from '@elastic/eui';

import type { ApmUrlParams } from '../../../../../context/url_params_context/types';
import {
  IWaterfall,
  WaterfallLegendType,
} from './waterfall/waterfall_helpers/waterfall_helpers';
import { Waterfall } from './waterfall';
import { WaterfallLegends } from './waterfall_legends';
import { useApmServiceContext } from '../../../../../context/apm_service/use_apm_service_context';
import { calculateCriticalPath } from './critical_path';

interface Props {
  urlParams: ApmUrlParams;
  waterfall: IWaterfall;
}

export function WaterfallContainer({ urlParams, waterfall }: Props) {
  const { serviceName } = useApmServiceContext();
  const [ showInTabCriticalPath, setShowInTabCriticalPath] = useState(false);
  if (!waterfall) {
    return null;
  }

  if (showInTabCriticalPath  && waterfall.entryWaterfallTransaction && !waterfall.entryWaterfallTransaction.criticalPath){
    calculateCriticalPath(waterfall)
  }

  const { legends, items } = waterfall;

  // Service colors are needed to color the dot in the error popover
  const serviceLegends = legends.filter(
    ({ type }) => type === WaterfallLegendType.ServiceName
  );
  const serviceColors = serviceLegends.reduce((colorMap, legend) => {
    return {
      ...colorMap,
      [legend.value!]: legend.color,
    };
  }, {} as Record<string, string>);

  // only color by span type if there are only events for one service
  const colorBy =
    serviceLegends.length > 1
      ? WaterfallLegendType.ServiceName
      : WaterfallLegendType.SpanType;

  const displayedLegends = legends.filter((legend) => legend.type === colorBy);

  const legendsByValue = keyBy(displayedLegends, 'value');

  // mutate items rather than rebuilding both items and childrenByParentId
  items.forEach((item) => {
    let color = '';
    if ('legendValues' in item) {
      color = legendsByValue[item.legendValues[colorBy]].color;
    }

    if (!color) {
      // fall back to service color if there's no span.type, e.g. for transactions
      color = serviceColors[item.doc.service.name];
    }

    item.color = color;
  });

  // default to serviceName if value is empty, e.g. for transactions (which don't
  // have span.type or span.subtype)
  const legendsWithFallbackLabel = displayedLegends.map((legend) => {
    return { ...legend, value: !legend.value ? serviceName : legend.value };
  });

  return (
    <div>
      <EuiFlexGroup direction="row" gutterSize="s" justifyContent='spaceBetween'>
            <EuiFlexItem grow={false} key={"legend"}>
              <WaterfallLegends legends={legendsWithFallbackLabel} type={colorBy} />
            </EuiFlexItem>
            <EuiFlexItem grow={false} key={"critical path button"}>
              <EuiSwitch
                label="Show critical path"
                checked={showInTabCriticalPath}
                onChange={() => setShowInTabCriticalPath(!showInTabCriticalPath)}
              />
            </EuiFlexItem>
      </EuiFlexGroup>
      
      <Waterfall
        waterfallItemId={urlParams.waterfallItemId}
        waterfall={waterfall}
        showCriticalPath={showInTabCriticalPath}
      />
    </div>
  );
}
