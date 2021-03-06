/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IRouter } from 'kibana/server';
import { EndpointAppContext } from '../types';
import {
  validateTreeEntityID,
  validateEvents,
  validateChildren,
  validateAncestry,
  validateAlerts,
  validateEntities,
  validateTree,
} from '../../../common/endpoint/schema/resolver';
import { handleChildren } from './resolver/children';
import { handleAncestry } from './resolver/ancestry';
import { handleTree as handleTreeEntityID } from './resolver/tree';
import { handleTree } from './resolver/tree/handler';
import { handleAlerts } from './resolver/alerts';
import { handleEntities } from './resolver/entity';
import { handleEvents } from './resolver/events';

export function registerResolverRoutes(router: IRouter, endpointAppContext: EndpointAppContext) {
  const log = endpointAppContext.logFactory.get('resolver');

  router.post(
    {
      path: '/api/endpoint/resolver/tree',
      validate: validateTree,
      options: { authRequired: true },
    },
    handleTree(log)
  );

  router.post(
    {
      path: '/api/endpoint/resolver/events',
      validate: validateEvents,
      options: { authRequired: true },
    },
    handleEvents(log)
  );

  /**
   * @deprecated will be removed because it is not used
   */
  router.post(
    {
      path: '/api/endpoint/resolver/{id}/alerts',
      validate: validateAlerts,
      options: { authRequired: true },
    },
    handleAlerts(log, endpointAppContext)
  );

  /**
   * @deprecated use the /resolver/tree api instead
   */
  router.get(
    {
      path: '/api/endpoint/resolver/{id}/children',
      validate: validateChildren,
      options: { authRequired: true },
    },
    handleChildren(log, endpointAppContext)
  );

  /**
   * @deprecated use the /resolver/tree api instead
   */
  router.get(
    {
      path: '/api/endpoint/resolver/{id}/ancestry',
      validate: validateAncestry,
      options: { authRequired: true },
    },
    handleAncestry(log, endpointAppContext)
  );

  /**
   * @deprecated use the /resolver/tree api instead
   */
  router.get(
    {
      path: '/api/endpoint/resolver/{id}',
      validate: validateTreeEntityID,
      options: { authRequired: true },
    },
    handleTreeEntityID(log, endpointAppContext)
  );

  /**
   * Used to get details about an entity, aka process.
   */
  router.get(
    {
      path: '/api/endpoint/resolver/entity',
      validate: validateEntities,
      options: { authRequired: true },
    },
    handleEntities()
  );
}
