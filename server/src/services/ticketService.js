import { query } from '../db/pool.js';
import { config } from '../config.js';

const PAGE_SIZE = 20;

/**
 * Returns SQL boolean expression evaluating to 1 if ticket has breached SLA, 0 otherwise.
 * A ticket is breached if:
 * 1. It is active (status in 'open' or 'pending').
 * 2. Elapsed time since creation exceeds the SLA target hours for its priority.
 * 3. It has received no public response from an agent or admin.
 */
function getBreachCondition(alias = 't') {
  const p1 = Number(config.slaTargets.P1 || 4);
  const p2 = Number(config.slaTargets.P2 || 24);
  const p3 = Number(config.slaTargets.P3 || 72);

  return `(${alias}.status IN ('open', 'pending')
    AND NOW() > DATE_ADD(${alias}.created_at, INTERVAL (CASE ${alias}.priority WHEN 'P1' THEN ${p1} WHEN 'P2' THEN ${p2} WHEN 'P3' THEN ${p3} ELSE 72 END) HOUR)
    AND NOT EXISTS (
      SELECT 1 FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.ticket_id = ${alias}.id AND c.is_internal = 0 AND u.role IN ('agent', 'admin')
    ))`;
}

// Whitelist to prevent SQL injection — only these columns and directions are allowed.
const ALLOWED_SORT = ['created_at', 'updated_at', 'priority', 'status'];
const ALLOWED_ORDER = ['asc', 'desc'];

export async function listTickets({ orgId, page = 1, search = '', status, priority, sortBy = 'created_at', order = 'desc', breached = false }) {
  const safeSortBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
  const safeOrder = ALLOWED_ORDER.includes(order.toLowerCase()) ? order.toLowerCase() : 'desc';
  const breachCond = getBreachCondition('t');

  const where = ['t.org_id = ?'];
  const params = [orgId];

  if (search) {
    where.push('t.subject LIKE ?');
    params.push(`%${search}%`);
  }
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (priority) {
    where.push('t.priority = ?');
    params.push(priority);
  }
  if (breached === true || breached === 'true') {
    where.push(breachCond);
  }

  const whereSql = where.join(' AND ');
  const offset = page * PAGE_SIZE;

  const rows = await query(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
            t.assignee_id, u.name AS assignee_name, r.name AS requester_name,
            ${breachCond} AS is_breached
       FROM tickets t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN users r ON r.id = t.requester_id
      WHERE ${whereSql}
      ORDER BY t.${safeSortBy} ${safeOrder}
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  );

  // Attach the comment count each row needs for the list badge, and normalize is_breached.
  for (const row of rows) {
    const [{ c }] = await query('SELECT COUNT(*) AS c FROM comments WHERE ticket_id = ?', [row.id]);
    row.comment_count = c;
    row.is_breached = Boolean(row.is_breached);
  }

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM tickets t WHERE ${whereSql}`,
    params
  );

  return { rows, total, page, pageSize: PAGE_SIZE };
}

export async function getTicketById(id) {
  const breachCond = getBreachCondition('t');
  const rows = await query(
    `SELECT t.*, u.name AS assignee_name, r.name AS requester_name, r.email AS requester_email,
            ${breachCond} AS is_breached
       FROM tickets t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN users r ON r.id = t.requester_id
      WHERE t.id = ?`,
    [id]
  );
  if (!rows[0]) return null;
  rows[0].is_breached = Boolean(rows[0].is_breached);
  return rows[0];
}

export async function listComments(ticketId) {
  return query(
    `SELECT c.id, c.body, c.is_internal, c.created_at, u.name AS author_name, u.role AS author_role
       FROM comments c
       JOIN users u ON u.id = c.author_id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC`,
    [ticketId]
  );
}

export async function createTicket({ orgId, subject, body, priority, requesterId }) {
  const result = await query(
    `INSERT INTO tickets (org_id, subject, body, priority, requester_id)
     VALUES (?, ?, ?, ?, ?)`,
    [orgId, subject, body, priority, requesterId]
  );
  return getTicketById(result.insertId);
}

export async function assignTicket(ticketId, assigneeId) {
  const ticket = await getTicketById(ticketId);
  if (!ticket) return null;

  if (ticket.assignee_id) {
    return { conflict: true, ticket };
  }

  // Look up the agent so the response carries a display name for the toast.
  const [agent] = await query('SELECT id, name FROM users WHERE id = ?', [assigneeId]);

  await query('UPDATE tickets SET assignee_id = ?, status = ? WHERE id = ?', [assigneeId, 'pending', ticketId]);
  return { conflict: false, assignedTo: agent, ticket: await getTicketById(ticketId) };
}

export async function deleteTicket(id) {
  await query('DELETE FROM tickets WHERE id = ?', [id]);
}
