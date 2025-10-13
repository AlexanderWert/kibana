import { IL_IMPORTANT, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'LOG-002',
  description: 'Log records have their `severityNumber` set.',
  impactLevel: IL_IMPORTANT,
  target: SignalType.LOGS,
  rationale: `When using the filelog receiver of the OpenTelemetry Collector, or an equivalent way of reading logs from file, 
    and converting them to OpenTelemetry Log records, it is common for adopters not to specify a way to parse the log's severity 
    and transform it into the OTLP severityNumber fields. This leaves logs less actionable than they should be.`,
  criteria: 'Log records with `severity.text` = `UNSET` are not observed.'
}

export class Log002Rule extends InstScoreRule {
  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices} METADATA _id
      | WHERE data_stream.type == "logs"
          AND @timestamp > NOW() - ${this.lookbackSeconds}s
      | EVAL no_sev = severity_number IS NULL OR severity_number == 0
      | STATS
          ${this.EXAMPLE_VALUE} = SAMPLE(_id, 1) WHERE no_sev,
          ${this.REPR_COUNT} = COUNT(*) WHERE no_sev,
          ${this.REPR_DENOMINATOR} = COUNT(*)
            BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = ${this.REPR_COUNT} == 0
      | KEEP ${this.PASSED}, ${this.SERVICE_NAME}, ${this.EXAMPLE_VALUE}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}`;

  isExampleInEvaluationQuery = () => true;

  getExampleFieldName = () => "_id";
}