import assert from 'node:assert/strict';
import { createAgentraCountex, userBehaviorMap } from '@x12i/agentra-countex';
const scope = { tenantId: 'fixture-tenant', accountId: 'fixture-account', environment: 'dev' };
const events = [1, 2].map(index => ({ scope, event: { id: 'event-' + index, type: 'report.generated', createdAt: new Date().toISOString() },
  actor: { id: 'fixture-user', type: 'user' }, product: { app: 'example', feature: 'reports' }, classification: { status: 'success' },
}));
const counters = createAgentraCountex([userBehaviorMap]);
await counters.init();
await counters.ingestBatch(events);
await counters.flush();
import { AgentraQueryEngine } from '@x12i/agentra-query';
const query = new AgentraQueryEngine({ countex: counters });
// This map emits both user and account subjects; select one subject to count its events.
const spec = { scope: scope.tenantId, counterId: userBehaviorMap.counterId, timeframe: { type: 'day', relative: '7d' }, subject: { type: 'user', ids: ['fixture-user'] }, metrics: ['report.generated'], format: 'table' };
import { AgentraReportEngine } from '@x12i/agentra-reports';
try {
  const engine = new AgentraReportEngine(query);
  engine.save({ id: 'fixture-report', name: 'Example report', scope: scope.tenantId, timeframe: { relative: '7d' },
    sections: [{ id: 'intro', title: 'Context', type: 'text', content: 'Synthetic activity only.' }, { id: 'activity', title: 'Reports', type: 'table', query: spec }],
  });
  const snapshot = JSON.parse(await engine.exportJson('fixture-report'));
  assert.equal(snapshot.sections[0].output, 'Synthetic activity only.');
  assert(snapshot.sections[1].output.rows.some(row => row.count === 2));
  const csv = await engine.exportCsv('fixture-report');
  assert(csv.startsWith('sectionId,output'));
  console.log(csv);
} finally { await counters.shutdown(); }
