import { IL_CRITICAL, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";
import { EsqlEsqlColumnInfo } from "@elastic/elasticsearch/lib/api/types";
import { FieldValue } from "@kbn/esql-composer/src/types";

const TRACE = "trace";

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'SPA-C-002',
  description: 'Entry span to a service must be a transaction.',
  impactLevel: IL_CRITICAL,
  target: SignalType.SPANS,
  rationale: `Entry spans that have not been recognized as a transaction lead to broken APM UI views.
    For OTel service entry spans to be properly recognized as transactions,
    they need to properly follow the \`has_is_remote\` bits specification in the OTLP protobuf definition for traces 
    OR set the \`SpanKind\` to \`CONSUMER\` or \`SERVER\``,
  criteria: `Every span whose parent is from another service has a non-empty \`transaction.id\` field.`
}

export class SpaC002Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices}
      | WHERE data_stream.type == "traces" AND trace.id IS NOT NULL
          AND @timestamp > NOW() - ${this.lookbackSeconds}s
      | STATS u_transactions = COUNT(transaction.id) BY trace.id, ${this.SERVICE_NAME}
      | STATS 
          ${TRACE} = SAMPLE(trace.id, 1) WHERE u_transactions == 0,
          min_txn = MIN(u_transactions),
          ${this.REPR_COUNT} = COUNT(*) WHERE u_transactions == 0,
          ${this.REPR_DENOMINATOR} = COUNT(*)
        BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = min_txn >= 1
      | KEEP ${this.PASSED}, ${this.SERVICE_NAME}, ${TRACE}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}`;


  getExampleQuery = (serviceName: string,
    columns: EsqlEsqlColumnInfo[],
    row: FieldValue[]) => {
    const tracesColIdx = columns.findIndex(col => col.name === TRACE);
    const traceId = row[tracesColIdx] as string;
    if (traceId) {
      return `FROM ${this.indices}
            | WHERE data_stream.type == "traces" AND trace.id == "${traceId}"
            | FORK 
              ( EVAL x_id = span.id)
              ( EVAL x_id = parent.id)
            | INLINE STATS parent_service = VALUES(${this.SERVICE_NAME}) BY x_id
            | MV_EXPAND parent_service
            | EVAL is_txn = (transaction.id IS NOT NULL AND transaction.id == span.id)
            | WHERE parent_service != ${this.SERVICE_NAME}
                AND ${this.SERVICE_NAME} == "${serviceName}"
                AND NOT is_txn
            | STATS ${this.EXAMPLE_VALUE} = SAMPLE(span.id, 1)`;

    } else {
      return undefined;
    }
  }

  isExampleInEvaluationQuery = () => false;

  getExampleFieldName = () => "span.id";
}