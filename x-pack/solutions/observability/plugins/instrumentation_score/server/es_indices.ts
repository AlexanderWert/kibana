import { APMIndices } from "@kbn/apm-sources-access-plugin/server";
import { ElasticsearchClient, type Logger } from "@kbn/core/server";
import { SignalType } from "./types";
import { InstScoreSignalIndices } from "./config";

const otel_pattern = /^(.+:)?(logs|metrics|traces)-.+\.otel-.+$/;

export class InstScoreTargetIndices {

  es!: ElasticsearchClient;
  resolvedIndices!: string;
  logger: Logger;
  indices: Map<SignalType, string> = new Map();

  constructor(
    logger: Logger,
    es: ElasticsearchClient
  ) {
    this.logger = logger;
    this.es = es;
  }

  public async init(indicesFromConfig: InstScoreSignalIndices, apmIndices: APMIndices) {
    const spansIndices = indicesFromConfig.spans ? indicesFromConfig.spans : [apmIndices.span, apmIndices.transaction].join(',');
    this.indices.set(SignalType.SPANS, await this.resolveIndices(spansIndices));

    const metricsIndices = indicesFromConfig.metrics ? indicesFromConfig.metrics : apmIndices.metric;
    this.indices.set(SignalType.METRICS, await this.resolveIndices(metricsIndices));

    const logsIndices = indicesFromConfig.logs ? indicesFromConfig.logs : [apmIndices.error, "logs-*.otel-*", "*:logs-*.otel-*"].join(',');
    this.indices.set(SignalType.LOGS, await this.resolveIndices(logsIndices));

    this.indices.set(SignalType.RESOURCE, await this.resolveIndices([spansIndices, metricsIndices, logsIndices].join(',')));
  }

  private async resolveIndices(indicesStr: string) {
    const parts = indicesStr.split(',');
    const partsSet = new Set(parts);
    const keep = [];
    for (const p of partsSet) {
      if (otel_pattern.test(p)) {
        try {
          const r = await this.es.indices.resolveIndex({ name: p, allow_no_indices: true });
          if ((r.indices?.length || 0) + (r.data_streams?.length || 0) + (r.aliases?.length || 0) > 0) {
            keep.push(p);
          }
        } catch {/* ignore 404s */ }
      }
    }
    return keep.join(',');
  }

  public get(target: SignalType) {
    return this.indices.get(target) || '';
  }
}