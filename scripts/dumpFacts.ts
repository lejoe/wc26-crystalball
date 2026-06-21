/**
 * Print the deterministic analysis facts for every ready group, plus the shared
 * cross-group third-place table, as JSON on stdout. This is the input the
 * `generate-group-analysis` skill feeds to the AI.
 *
 *   npx tsx scripts/dumpFacts.ts > /tmp/analysis-facts.json
 */
import { allGroupAnalysisFacts } from '../src/groupAnalysis'

console.log(JSON.stringify(allGroupAnalysisFacts(), null, 2))
