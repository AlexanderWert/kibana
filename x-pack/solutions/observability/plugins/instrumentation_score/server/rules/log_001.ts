import { IL_IMPORTANT, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const LOWEST_INFO_LEVEL = 9;

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'LOG-001',
  description: 'Debug-level logs are not enabled in production environments for longer than 14 days.',
  impactLevel: IL_IMPORTANT,
  target: SignalType.LOGS,
  rationale: `Debug-level logging should generally not be enabled long-term.
    Retaining debug logs for extended periods in production can lead to increased storage costs,
    potential security concerns due to sensitive information being logged, and noisy logs that make troubleshooting more difficult. 
    This rule helps identify situations where debug logging is left on inadvertently in production.`,
  criteria: `Log records with \`severity_number < 9\`  (i.e. <= DEBUG) are not observed for longer than 14 days.`
}

export class Log001Rule extends InstScoreRule {
  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => {
    return `FROM ${this.indices} METADATA _id
      | WHERE
        data_stream.type == "logs" AND
          (log.level IS NOT NULL OR severity_number IS NOT NULL)
      | KEEP @timestamp, log.level, severity_number, _id, ${this.SERVICE_NAME}
      | FORK 
        (WHERE @timestamp > NOW() - ${this.lookbackSeconds}s)
        (WHERE @timestamp > NOW() - 14days - ${this.lookbackSeconds}s AND @timestamp < NOW() - 14days)
      | EVAL
          high_log_level =
            ((TRIM(TO_UPPER(log.level)) IN ("DEBUG", "TRACE")) OR
              severity_number < ${LOWEST_INFO_LEVEL} AND severity_number > 0)
      | STATS c_high_log_level_past = COUNT(*) WHERE high_log_level AND _fork == "fork2",
          c_high_log_level_now = COUNT(*) WHERE high_log_level AND _fork == "fork1",
          example = SAMPLE(_id, 1) WHERE high_log_level AND _fork == "fork1",
          ${this.REPR_DENOMINATOR} = COUNT(*) WHERE _fork == "fork1"
            BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = c_high_log_level_now == 0 OR c_high_log_level_past == 0
      | EVAL ${this.EXAMPLE_VALUE} = CASE(${this.PASSED}, NULL, example)
      | EVAL ${this.REPR_COUNT} = c_high_log_level_now
      | KEEP ${this.SERVICE_NAME}, ${this.PASSED}, ${this.EXAMPLE_VALUE}, ${this.REPR_DENOMINATOR}, ${this.REPR_COUNT}`;
    }

  isExampleInEvaluationQuery = () => true;

  getExampleFieldName = () => "_id";
}