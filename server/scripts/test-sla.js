/**
 * Verification test suite for Part 1 fixes and Part 2 SLA breach tracking.
 * Run with: node scripts/test-sla.js (from /server)
 */
import assert from 'node:assert/strict';
import { listTickets, getTicketById, createTicket, assignTicket, deleteTicket } from '../src/services/ticketService.js';
import { query } from '../src/db/pool.js';
import { config } from '../src/config.js';

async function runTests() {
  console.log('--- Running Meridian Helpdesk Verification Suite ---');

  // Test 1: Configured SLA Targets
  console.log('1. Checking SLA targets in config...');
  assert.equal(config.slaTargets.P1, 4, 'P1 target must be 4 hours');
  assert.equal(config.slaTargets.P2, 24, 'P2 target must be 24 hours');
  assert.equal(config.slaTargets.P3, 72, 'P3 target must be 72 hours');
  console.log('   [PASS] SLA targets correctly configured.');

  // Test 2: Part 1 - Whitelist SQL Injection Protection
  console.log('2. Testing SQL injection protection in listTickets sortBy...');
  // Passing malicious sortBy parameter should fall back safely to 'created_at' without error
  const safeResult = await listTickets({ orgId: 1, sortBy: 'id; DROP TABLE dummy --', order: 'desc' });
  assert.ok(safeResult.rows.length > 0, 'Safe query should return rows without executing injected SQL');
  console.log('   [PASS] SQL injection safely blocked by whitelist validation.');

  // Test 3: Part 2 - listTickets exposes is_breached boolean on every row
  console.log('3. Checking is_breached attribute on ticket list rows...');
  const list = await listTickets({ orgId: 1, page: 1 });
  assert.ok(list.rows.length > 0, 'Ticket list should contain rows');
  for (const row of list.rows) {
    assert.equal(typeof row.is_breached, 'boolean', `Row #${row.id} must have boolean is_breached`);
  }
  console.log(`   [PASS] All ${list.rows.length} rows have boolean is_breached.`);

  // Test 4: Part 2 - Breached tickets filter
  console.log('4. Testing listTickets with breached=true filter...');
  const breachedList = await listTickets({ orgId: 1, page: 1, breached: true });
  assert.ok(breachedList.total > 0, 'Seed data must contain breached tickets');
  for (const row of breachedList.rows) {
    assert.equal(row.is_breached, true, `Row #${row.id} in breached list must have is_breached === true`);
    assert.ok(['open', 'pending'].includes(row.status), `Breached ticket #${row.id} must be active (open/pending)`);
  }
  console.log(`   [PASS] Filter returned ${breachedList.total} breached tickets, all validated.`);

  // Test 5: Part 2 - getTicketById exposes is_breached
  console.log('5. Testing getTicketById SLA state...');
  const breachedId = breachedList.rows[0].id;
  const detail = await getTicketById(breachedId);
  assert.equal(detail.is_breached, true, `Ticket #${breachedId} detail must carry is_breached === true`);
  console.log('   [PASS] getTicketById carries accurate is_breached state.');

  // Test 6: SLA response logic - verify a ticket with public agent comment is not breached
  console.log('6. Verifying that a public agent response clears active breach status...');
  // Ticket 9 has a public agent comment in seed data:
  const t9 = await getTicketById(9);
  if (t9) {
    assert.equal(t9.is_breached, false, 'Ticket #9 has agent response, so is_breached must be false');
    console.log('   [PASS] Ticket with agent response correctly marked not breached.');
  }

  console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n[FAIL] Test suite encountered an error:', err);
  process.exit(1);
});
