import { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import { type Logger, ElasticsearchClient } from '@kbn/core/server';

const INST_SCORE_RULES_RESULTS_INDEX_TEMPLATE_NAME = "inst_score_rules_results_template";
const INST_SCORE_INDEX_TEMPLATE_NAME = "inst_score_template";


export const DEST_INDEX_RULES_RESULTS = 'inst_score-rules-results';
const DEST_INDEX_RULES_RESULTS_MAPPINGS : MappingTypeMapping = { 
  properties: {
    "@timestamp": { type: 'date' },
    rule: {
      properties: {
        id: { type: 'keyword' },
        impact_level: {
          properties: {
            name: { type: 'keyword' },
            weight: { type: 'integer' }
          }
        }
      }
    },
    "service.name": { type: 'keyword' },
    result: { type: 'keyword' },
    example: { 
      properties: {
        field: { type: 'keyword' },
        value: { type: 'keyword' }
      } 
    },
    extent: {
      properties: {
        count: { type: 'integer' },
        total: { type: 'integer' }
      } 
    }
  } 
};

export const DEST_INDEX_SCORE = 'inst_score-score';
const DEST_INDEX_SCORE_MAPPINGS : MappingTypeMapping = {
  properties: {
    "@timestamp": { type: 'date' },
    "service.name": { type: 'keyword' },
    instrumentation_score: { type: 'float' }
  } 
};

export const DEST_INDEX_RULES_DEFINITIONS = 'inst_score-rules-definitions';
const DEST_INDEX_RULES_DEFINITIONS_MAPPINGS : MappingTypeMapping = {
  properties: {
    rule: {
      properties: {
        id: { type: 'keyword' },
        description: { type: 'text' },
        rationale: { type: 'text' },
        criteria: { type: 'text' },
        target: { type: 'keyword' },
        impact_level: {
          properties: {
            name: { type: 'keyword' },
            weight: { type: 'integer' }
          }
        }
      }
    }
  } 
};

export class InstScoreESIndexInitializer {
  private logger: Logger;
  private es: ElasticsearchClient;

  constructor(
    logger: Logger,
    es: ElasticsearchClient
  ) {
    this.logger = logger;
    this.es = es;
  }

  private async createDataStreamTemplate(templateName: string, indexPatterns: string[], mappings: MappingTypeMapping) {

    const got = await this.es.indices.getIndexTemplate({ name: templateName }, { ignore: [404] });
    const templateExists = (got as any).statusCode === 200;

    if (!templateExists) {
      this.logger.debug(`Creating data stream template ${templateName}`);
      await this.es.indices.putIndexTemplate({
        name: templateName,
        index_patterns: indexPatterns,
        // This flag turns indices matching the patterns into a DATA STREAM
        data_stream: {},
        template: {
          lifecycle: {
            data_retention: "7d"
          },
          mappings: mappings
        },
        priority: 100,
      });
    }
  }

  private async initRuleDefinitionIndex() {
    try {
      const exists = await this.es.indices.exists({ index: DEST_INDEX_RULES_DEFINITIONS }, { ignore: [404] });
      if (!exists) {
        this.logger.debug(`Creating index ${DEST_INDEX_RULES_DEFINITIONS}`);
        await this.es.indices.create({
          index: DEST_INDEX_RULES_DEFINITIONS,
          mappings: DEST_INDEX_RULES_DEFINITIONS_MAPPINGS,
          settings: {
            index: {
              mode: 'lookup'
            }
          }
        });
      }
    } catch (error) {
      this.logger.error(`Error creating index ${DEST_INDEX_RULES_DEFINITIONS}: ${error}`);
    }
  }

  public async initialize() {
    try {
      await this.initRuleDefinitionIndex();
      await this.createDataStreamTemplate(
        INST_SCORE_RULES_RESULTS_INDEX_TEMPLATE_NAME,
        [`${DEST_INDEX_RULES_RESULTS}*`],
        DEST_INDEX_RULES_RESULTS_MAPPINGS
      );
      await this.createDataStreamTemplate(
        INST_SCORE_INDEX_TEMPLATE_NAME,
        [`${DEST_INDEX_SCORE}*`],
        DEST_INDEX_SCORE_MAPPINGS
      );
    } catch (error) {
      this.logger.error(`Error initializing indices: ${error}`);
    } 
  }
}