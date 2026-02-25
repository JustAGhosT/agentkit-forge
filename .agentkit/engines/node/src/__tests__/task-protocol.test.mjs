/**
 * Tests for task-protocol.mjs — A2A-lite task delegation protocol.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  createTask,
  getTask,
  listTasks,
  updateTaskStatus,
  addTaskMessage,
  addTaskArtifact,
  checkDependencies,
  processHandoffs,
  generateTaskId,
  formatTaskSummary,
  formatTaskList,
  TASK_STATES,
  TERMINAL_STATES,
  TASK_TYPES,
  TASK_PRIORITIES,
} from '../task-protocol.mjs';

let tmpRoot;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'agentkit-task-test-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Task ID generation
// ---------------------------------------------------------------------------

describe('generateTaskId', () => {
  it('generates sequential IDs for the same day', () => {
    const id1 = generateTaskId(tmpRoot);
    expect(id1).toMatch(/^task-\d{8}-001$/);

    // Create a task so next ID increments
    createTask(tmpRoot, {
      title: 'First', delegator: 'test', assignees: ['team-backend'],
    });
    const id2 = generateTaskId(tmpRoot);
    expect(id2).toMatch(/^task-\d{8}-002$/);
  });
});

// ---------------------------------------------------------------------------
// CRUD — createTask
// ---------------------------------------------------------------------------

describe('createTask', () => {
  it('creates a task with valid data', () => {
    const result = createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['team-backend'],
      title: 'Add pagination',
      description: 'Implement cursor-based pagination',
      priority: 'P1',
      acceptanceCriteria: ['supports cursor param', 'returns nextCursor'],
      scope: ['src/api/**'],
    });

    expect(result.error).toBeUndefined();
    expect(result.task).toBeDefined();
    expect(result.task.id).toMatch(/^task-\d{8}-\d{3}$/);
    expect(result.task.status).toBe('submitted');
    expect(result.task.type).toBe('implement');
    expect(result.task.priority).toBe('P1');
    expect(result.task.delegator).toBe('orchestrator');
    expect(result.task.assignees).toEqual(['team-backend']);
    expect(result.task.messages).toHaveLength(1);
    expect(result.task.messages[0].role).toBe('delegator');
  });

  it('returns error for missing title', () => {
    const result = createTask(tmpRoot, {
      delegator: 'test', assignees: ['team-backend'],
    });
    expect(result.error).toContain('title is required');
    expect(result.task).toBeNull();
  });

  it('returns error for missing delegator', () => {
    const result = createTask(tmpRoot, {
      title: 'Test', assignees: ['team-backend'],
    });
    expect(result.error).toContain('delegator is required');
  });

  it('returns error for empty assignees', () => {
    const result = createTask(tmpRoot, {
      title: 'Test', delegator: 'test', assignees: [],
    });
    expect(result.error).toContain('At least one assignee');
  });

  it('returns error for invalid task type', () => {
    const result = createTask(tmpRoot, {
      title: 'Test', delegator: 'test', assignees: ['x'], type: 'invalid',
    });
    expect(result.error).toContain('Invalid task type');
  });

  it('returns error for invalid priority', () => {
    const result = createTask(tmpRoot, {
      title: 'Test', delegator: 'test', assignees: ['x'], priority: 'P9',
    });
    expect(result.error).toContain('Invalid priority');
  });

  it('defaults type to implement and priority to P2', () => {
    const result = createTask(tmpRoot, {
      title: 'Test', delegator: 'test', assignees: ['x'],
    });
    expect(result.task.type).toBe('implement');
    expect(result.task.priority).toBe('P2');
  });

  it('returns error for non-existent dependency', () => {
    const result = createTask(tmpRoot, {
      title: 'Test', delegator: 'test', assignees: ['x'],
      dependsOn: ['task-99999999-999'],
    });
    expect(result.error).toContain('Dependency task not found');
  });

  it('sets blockedBy when dependency is not yet complete', () => {
    const dep = createTask(tmpRoot, {
      title: 'Dep', delegator: 'test', assignees: ['x'],
    });
    const result = createTask(tmpRoot, {
      title: 'Blocked', delegator: 'test', assignees: ['y'],
      dependsOn: [dep.task.id],
    });
    expect(result.task.blockedBy).toContain(dep.task.id);
  });
});

// ---------------------------------------------------------------------------
// CRUD — getTask
// ---------------------------------------------------------------------------

describe('getTask', () => {
  it('retrieves an existing task', () => {
    const created = createTask(tmpRoot, {
      title: 'Test', delegator: 'test', assignees: ['x'],
    });
    const result = getTask(tmpRoot, created.task.id);
    expect(result.task).toBeDefined();
    expect(result.task.title).toBe('Test');
  });

  it('returns error for non-existent task', () => {
    const result = getTask(tmpRoot, 'task-00000000-999');
    expect(result.error).toContain('not found');
    expect(result.task).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CRUD — listTasks
// ---------------------------------------------------------------------------

describe('listTasks', () => {
  it('returns empty list when no tasks exist', () => {
    expect(listTasks(tmpRoot).tasks).toEqual([]);
  });

  it('lists all tasks', () => {
    createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['x'] });
    createTask(tmpRoot, { title: 'B', delegator: 'test', assignees: ['y'] });
    expect(listTasks(tmpRoot).tasks).toHaveLength(2);
  });

  it('filters by status', () => {
    createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['x'] });
    expect(listTasks(tmpRoot, { status: 'submitted' }).tasks).toHaveLength(1);
    expect(listTasks(tmpRoot, { status: 'completed' }).tasks).toHaveLength(0);
  });

  it('filters by assignee', () => {
    createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['team-backend'] });
    createTask(tmpRoot, { title: 'B', delegator: 'test', assignees: ['team-frontend'] });
    expect(listTasks(tmpRoot, { assignee: 'team-backend' }).tasks).toHaveLength(1);
  });

  it('sorts by priority then date', () => {
    createTask(tmpRoot, { title: 'Low', delegator: 'test', assignees: ['x'], priority: 'P3' });
    createTask(tmpRoot, { title: 'High', delegator: 'test', assignees: ['x'], priority: 'P0' });
    const { tasks } = listTasks(tmpRoot);
    expect(tasks[0].title).toBe('High');
    expect(tasks[1].title).toBe('Low');
  });
});

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

describe('updateTaskStatus', () => {
  it('transitions submitted → accepted', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = updateTaskStatus(tmpRoot, created.task.id, 'accepted', {
      from: 'team-backend', content: 'Accepted.',
    });
    expect(result.task.status).toBe('accepted');
    expect(result.task.messages).toHaveLength(2);
  });

  it('transitions accepted → working', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    const result = updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    expect(result.task.status).toBe('working');
  });

  it('transitions working → completed', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    const result = updateTaskStatus(tmpRoot, created.task.id, 'completed', { from: 'x' });
    expect(result.task.status).toBe('completed');
  });

  it('rejects invalid transition submitted → completed', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = updateTaskStatus(tmpRoot, created.task.id, 'completed', { from: 'x' });
    expect(result.error).toContain('Invalid transition');
  });

  it('rejects transition from terminal state', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    updateTaskStatus(tmpRoot, created.task.id, 'rejected', { from: 'x' });
    const result = updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    expect(result.error).toContain('none (terminal state)');
  });

  it('supports submitted → rejected', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = updateTaskStatus(tmpRoot, created.task.id, 'rejected', {
      from: 'team-backend', content: 'Not in my scope.',
    });
    expect(result.task.status).toBe('rejected');
  });

  it('supports working → input-required → working', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    updateTaskStatus(tmpRoot, created.task.id, 'input-required', { from: 'x' });
    const result = updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    expect(result.task.status).toBe('working');
  });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

describe('addTaskMessage', () => {
  it('adds a message to a task', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = addTaskMessage(tmpRoot, created.task.id, {
      role: 'executor', from: 'team-backend', content: 'Working on it.',
    });
    expect(result.task.messages).toHaveLength(2);
    expect(result.task.messages[1].content).toBe('Working on it.');
  });

  it('rejects message on terminal task', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    updateTaskStatus(tmpRoot, created.task.id, 'rejected', { from: 'x' });
    const result = addTaskMessage(tmpRoot, created.task.id, {
      role: 'delegator', from: 'test', content: 'Please reconsider.',
    });
    expect(result.error).toContain('terminal state');
  });

  it('rejects invalid message role', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = addTaskMessage(tmpRoot, created.task.id, {
      role: 'observer', from: 'test', content: 'Hi.',
    });
    expect(result.error).toContain('Invalid message role');
  });
});

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

describe('addTaskArtifact', () => {
  it('adds a files-changed artifact', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = addTaskArtifact(tmpRoot, created.task.id, {
      type: 'files-changed',
      paths: ['src/api/users.ts'],
      summary: 'Added pagination',
    });
    expect(result.task.artifacts).toHaveLength(1);
    expect(result.task.artifacts[0].type).toBe('files-changed');
    expect(result.task.artifacts[0].addedAt).toBeDefined();
  });

  it('adds a test-results artifact', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = addTaskArtifact(tmpRoot, created.task.id, {
      type: 'test-results', passed: 10, failed: 0, added: 3,
    });
    expect(result.task.artifacts[0].passed).toBe(10);
  });

  it('rejects invalid artifact type', () => {
    const created = createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = addTaskArtifact(tmpRoot, created.task.id, { type: 'banana' });
    expect(result.error).toContain('Invalid artifact type');
  });
});

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

describe('checkDependencies', () => {
  it('unblocks task when dependency completes', () => {
    const dep = createTask(tmpRoot, { title: 'Dep', delegator: 'test', assignees: ['a'] });
    const blocked = createTask(tmpRoot, {
      title: 'Blocked', delegator: 'test', assignees: ['b'],
      dependsOn: [dep.task.id],
    });
    expect(blocked.task.blockedBy).toContain(dep.task.id);

    // Complete the dependency
    updateTaskStatus(tmpRoot, dep.task.id, 'accepted', { from: 'a' });
    updateTaskStatus(tmpRoot, dep.task.id, 'working', { from: 'a' });
    updateTaskStatus(tmpRoot, dep.task.id, 'completed', { from: 'a' });

    const { unblocked } = checkDependencies(tmpRoot);
    expect(unblocked).toContain(blocked.task.id);

    // Verify blockedBy is now empty
    const updated = getTask(tmpRoot, blocked.task.id);
    expect(updated.task.blockedBy).toEqual([]);
  });

  it('keeps task blocked when dependency is still in progress', () => {
    const dep = createTask(tmpRoot, { title: 'Dep', delegator: 'test', assignees: ['a'] });
    createTask(tmpRoot, {
      title: 'Blocked', delegator: 'test', assignees: ['b'],
      dependsOn: [dep.task.id],
    });

    const { unblocked } = checkDependencies(tmpRoot);
    expect(unblocked).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Handoff processing
// ---------------------------------------------------------------------------

describe('processHandoffs', () => {
  it('creates follow-up tasks for completed tasks with handoffTo', () => {
    const task = createTask(tmpRoot, {
      title: 'Schema migration', delegator: 'orchestrator', assignees: ['data'],
      handoffTo: ['backend'],
      handoffContext: 'Migration applied. Update API to use new cursor field.',
    });

    // Complete the task
    updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'data' });
    updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'data' });
    updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'data' });

    const { created, errors } = processHandoffs(tmpRoot);
    expect(errors).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0].title).toContain('[Handoff]');
    expect(created[0].assignees).toEqual(['backend']);
    expect(created[0].description).toContain('cursor field');
    expect(created[0].context.handoffFrom).toBe(task.task.id);
  });

  it('does not re-process already processed handoffs', () => {
    const task = createTask(tmpRoot, {
      title: 'Test', delegator: 'orchestrator', assignees: ['a'],
      handoffTo: ['b'],
    });
    updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'a' });
    updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'a' });
    updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'a' });

    processHandoffs(tmpRoot);
    const { created } = processHandoffs(tmpRoot);
    expect(created).toHaveLength(0);
  });

  it('creates tasks for multiple handoff targets', () => {
    const task = createTask(tmpRoot, {
      title: 'Shared lib update', delegator: 'orchestrator', assignees: ['platform'],
      handoffTo: ['backend', 'frontend'],
      handoffContext: 'Shared types updated.',
    });
    updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'platform' });
    updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'platform' });
    updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'platform' });

    const { created } = processHandoffs(tmpRoot);
    expect(created).toHaveLength(2);
    expect(created.map(t => t.assignees[0]).sort()).toEqual(['backend', 'frontend']);
  });

  it('skips tasks with no handoffTo', () => {
    const task = createTask(tmpRoot, {
      title: 'Solo', delegator: 'test', assignees: ['x'],
    });
    updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'x' });
    updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'x' });
    updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'x' });

    const { created } = processHandoffs(tmpRoot);
    expect(created).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

describe('formatTaskSummary', () => {
  it('produces a readable summary', () => {
    const { task } = createTask(tmpRoot, {
      title: 'Test task', delegator: 'orchestrator', assignees: ['team-backend'],
      priority: 'P1', handoffTo: ['team-testing'],
    });
    const summary = formatTaskSummary(task);
    expect(summary).toContain('Test task');
    expect(summary).toContain('P1');
    expect(summary).toContain('team-backend');
    expect(summary).toContain('team-testing');
  });
});

describe('formatTaskList', () => {
  it('returns message for empty list', () => {
    expect(formatTaskList([])).toBe('No tasks found.');
  });

  it('produces a markdown table', () => {
    createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['x'], priority: 'P0' });
    createTask(tmpRoot, { title: 'B', delegator: 'test', assignees: ['y'], priority: 'P2' });
    const { tasks } = listTasks(tmpRoot);
    const table = formatTaskList(tasks);
    expect(table).toContain('| ID |');
    expect(table).toContain('submitted');
  });
});
