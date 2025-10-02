import { EvalResultValues, IL_IMPORTANT, InstScoreRuleEvaluationResult, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const SERVICE_NAME = 'resource.attributes.service.name';
const SPAN_IDS = "all_spans_in_trace";
const PARENT_IDS = "parent_ids";
const TRACE_ID = "trace.id";

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'SPA-002',
  description: 'Traces do not contain orphan spans.',
  impactLevel: IL_IMPORTANT,
  target: SignalType.SPANS,
  rationale: `Orphaned spans indicate potential issues in tracing instrumentation or data integrity. 
    This can lead to incomplete or misleading trace data, hindering effective troubleshooting and performance analysis.`,
  criteria: 'No span exists in a trace where the parent_span_id reference cannot be found within the same trace.',
}

export class Spa002Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => undefined; // Not applicable, custom evaluate() implementation below

  getExampleFieldName = () => undefined; // Not applicable, custom evaluate() implementation below

  async evaluate(allServices: string[]): Promise<Map<string, InstScoreRuleEvaluationResult>> {
    const from_delta = this.lookbackSeconds;
    const buffer = 300; // 5 minutes buffer to account for delays in data ingestion
    const tracesQuery = `FROM ${this.indices}
      | WHERE data_stream.type == "traces" 
        AND ${TRACE_ID} IS NOT NULL
        AND @timestamp > NOW() - ${(from_delta - buffer)}s AND @timestamp <= NOW() - ${buffer}s
      | STATS trace_ids = SAMPLE(${TRACE_ID}, 1000)`

    const respTraces = await this.es.esql.query({
      query: tracesQuery,
      drop_null_columns: true,
      include_ccs_metadata: true,
    });

    const traceIds = respTraces.values[0][0] as unknown as string[];

    const query = `FROM ${this.indices}
      | WHERE data_stream.type == "traces" 
          AND @timestamp > NOW() - ${from_delta}s
          AND ${TRACE_ID} IN (${traceIds.map(id => `"${id}"`).join(",")})
      | STATS spans = VALUES(span.id), ${PARENT_IDS} = VALUES(parent.id) BY ${SERVICE_NAME}, ${TRACE_ID}
      | INLINE STATS ${SPAN_IDS} = VALUES(spans) BY ${TRACE_ID}
      | KEEP ${PARENT_IDS}, ${SPAN_IDS}, ${SERVICE_NAME}, ${TRACE_ID}`;

    const resp = await this.es.esql.query({
      query: query,
      drop_null_columns: true,
      include_ccs_metadata: true,
    });

    const serviceNameColIdx = resp.columns.findIndex(col => col.name === SERVICE_NAME)
    const spanIdsIdColIdx = resp.columns.findIndex(col => col.name === SPAN_IDS)
    const parentIdsIdColIdx = resp.columns.findIndex(col => col.name === PARENT_IDS)

    const passedPerService = new Map<string, boolean>();
    const samplePerService = new Map<string, string>();
    const checkedServices: string[] = [];
    for (const row of resp.values || []) {
      const serviceName = row[serviceNameColIdx] as string;
      checkedServices.push(serviceName);
      if (!passedPerService.has(serviceName)) {
        passedPerService.set(serviceName, true);
      }


      if (passedPerService.get(serviceName) === true) {
        const spanIds = (typeof row[spanIdsIdColIdx] === 'string') ? [row[spanIdsIdColIdx] as string] : (row[spanIdsIdColIdx] as unknown as string[] || []);
        const parentIds = (typeof row[parentIdsIdColIdx] === 'string') ? [row[parentIdsIdColIdx] as string] : (row[parentIdsIdColIdx] as unknown as string[] || []);

        const orphan = parentIds.filter(p => !spanIds.includes(p));
        if (orphan && orphan.length > 0) {
          passedPerService.set(serviceName, false);
          if (!samplePerService.get(serviceName)) {
            samplePerService.set(serviceName, orphan[0]);
          }
        }
      }
    }

    const result = new Map<string, InstScoreRuleEvaluationResult>();
    for (const service of passedPerService.keys()) {
      result.set(service, {
        result: passedPerService.get(service) ? EvalResultValues.PASSED : EvalResultValues.FAILED,
        example: !!samplePerService.get(service) ? {
          field: 'span.id',
          value: samplePerService.get(service) as string
        } : undefined
      });
    }

    allServices.filter(s => !checkedServices.includes(s)).forEach(s => result.set(s, { result: EvalResultValues.NOT_APPLICABLE, example: undefined }))

    return result;
  }
}