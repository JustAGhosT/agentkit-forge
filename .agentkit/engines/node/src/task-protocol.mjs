/**
 * AgentKit Forge — Task Protocol
 * File-based A2A-lite task delegation protocol.
 * Tasks are JSON files in .claude/state/tasks/ with lifecycle states,
 * messages, artifacts, dependency tracking, and chained handoffs.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid task lifecycle states. */
export const TASK_STATES = [
  'submitted', // created by delegator, awaiting assignee review
  'accepted', // assignee acknowledged the task
  'working', // assignee is actively working
  'input-required', // assignee needs info from delegator
  'completed', // task finished successfully
  'failed', // task finished with errors
  'rejected', // assignee declined the task
  'canceled', // delegator canceled the task
];

/** Terminal states — no further transitions allowed. */
export const TERMINAL_STATES = ['completed', 'failed', 'rejected', 'canceled'];

/** Valid task types. */
export const TASK_TYPES = ['implement', 'review', 'plan', 'investigate', 'test', 'document'];

/** Valid priority levels. */
export const TASK_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

/** Valid message roles. */
export const MESSAGE_ROLES = ['delegator', 'executor'];

/** Valid artifact types. */
export const ARTIFACT_TYPES = [
  'files-changed',
  'test-results',
  'review-findings',
  'plan',
  'summary',
];

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function tasksDir(projectRoot) {
  return resolve(projectRoot, '.claude', 'state', 'tasks');
}

function taskPath(projectRoot, taskId) {
  return resolve(tasksDir(projectRoot), `${taskId}.json`);
}

function ensureTasksDir(projectRoot) {
  const dir = tasksDir(projectRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a task ID in the format: task-YYYYMMDD-NNN
 * NNN is a zero-padded sequence number based on existing tasks for that day.
 * @param {string} projectRoot
 * @returns {string}
 */
export function generateTaskId(projectRoot) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `task-${dateStr}-`;

  const dir = tasksDir(projectRoot);
  let seq = 1;

  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json'));
    const nums = files
      .map((f) => {
        const match = f.replace('.json', '').replace(prefix, '');
        return parseInt(match, 10);
      })
      .filter((n) => !isNaN(n));
    if (nums.length > 0) {
      seq = Math.max(...nums) + 1;
    }
  }

  let candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  while (existsSync(taskPath(projectRoot, candidate))) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

function writeTaskFile(projectRoot, taskId, data) {
  ensureTasksDir(projectRoot);
  const path = taskPath(projectRoot, taskId);
  const tmpPath = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  renameSync(tmpPath, path);
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new task.
 * @param {string} projectRoot
 * @param {object} taskData
 * @param {string} taskData.type - One of TASK_TYPES
 * @param {string} taskData.delegator - Who created this task
 * @param {string[]} taskData.assignees - Target agents/teams
 * @param {string} taskData.title
 * @param {string} [taskData.description]
 * @param {string[]} [taskData.acceptanceCriteria]
 * @param {string[]} [taskData.scope]
 * @param {string} [taskData.priority] - One of TASK_PRIORITIES (default P2)
 * @param {string[]} [taskData.dependsOn] - Task IDs that must complete first
 * @param {string[]} [taskData.handoffTo] - Teams to auto-delegate to on completion
 * @param {string} [taskData.handoffContext] - Context for the handoff
 * @param {object} [taskData.context] - Additional context (backlogItemId, relatedFiles, etc.)
 * @returns {{ task: object, error?: string }}
 */
export function createTask(projectRoot, taskData) {
  // Validate required fields
  if (!taskData.title || typeof taskData.title !== 'string') {
    return { task: null, error: 'Task title is required' };
  }
  if (!taskData.delegator || typeof taskData.delegator !== 'string') {
    return { task: null, error: 'Task delegator is required' };
  }
  if (!Array.isArray(taskData.assignees) || taskData.assignees.length === 0) {
    return { task: null, error: 'At least one assignee is required' };
  }
  if (taskData.type && !TASK_TYPES.includes(taskData.type)) {
    return {
      task: null,
      error: `Invalid task type: ${taskData.type}. Valid: ${TASK_TYPES.join(', ')}`,
    };
  }
  if (taskData.priority && !TASK_PRIORITIES.includes(taskData.priority)) {
    return {
      task: null,
      error: `Invalid priority: ${taskData.priority}. Valid: ${TASK_PRIORITIES.join(', ')}`,
    };
  }

  // Validate dependsOn references exist
  if (Array.isArray(taskData.dependsOn)) {
    for (const depId of taskData.dependsOn) {
      if (!existsSync(taskPath(projectRoot, depId))) {
        return { task: null, error: `Dependency task not found: ${depId}` };
      }
    }
  }

  const now = new Date().toISOString();
  const taskId = generateTaskId(projectRoot);

  const task = {
    id: taskId,
    type: taskData.type || 'implement',
    status: 'submitted',
    priority: taskData.priority || 'P2',
    createdAt: now,
    updatedAt: now,

    delegator: taskData.delegator,
    assignees: taskData.assignees,
    dependsOn: taskData.dependsOn || [],
    blockedBy: [],

    title: taskData.title,
    description: taskData.description || '',
    acceptanceCriteria: taskData.acceptanceCriteria || [],
    scope: taskData.scope || [],
    context: taskData.context || {},

    messages: [
      {
        role: 'delegator',
        from: taskData.delegator,
        timestamp: now,
        content: taskData.description || taskData.title,
      },
    ],

    artifacts: [],

    handoffTo: taskData.handoffTo || [],
    handoffContext: taskData.handoffContext || '',
  };

  // Check if blocked by incomplete dependencies
  if (task.dependsOn.length > 0) {
    const blockers = [];
    for (const depId of task.dependsOn) {
      const dep = getTask(projectRoot, depId);
      if (dep.task && !TERMINAL_STATES.includes(dep.task.status)) {
        blockers.push(depId);
      }
      // If a dependency failed/rejected/canceled, mark this as blocked too
      if (dep.task && ['failed', 'rejected', 'canceled'].includes(dep.task.status)) {
        blockers.push(depId);
      }
    }
    task.blockedBy = blockers;
  }

  writeTaskFile(projectRoot, taskId, task);
  return { task };
}

/**
 * Get a task by ID.
 * @param {string} projectRoot
 * @param {string} taskId
 * @returns {{ task: object|null, error?: string }}
 */
export function getTask(projectRoot, taskId) {
  const path = taskPath(projectRoot, taskId);
  if (!existsSync(path)) {
    return { task: null, error: `Task not found: ${taskId}` };
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return { task: data };
  } catch (err) {
    return { task: null, error: `Failed to parse task ${taskId}: ${err.message}` };
  }
}

/**
 * List tasks with optional filters.
 * @param {string} projectRoot
 * @param {object} [filters]
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.assignee] - Filter by assignee
 * @param {string} [filters.delegator] - Filter by delegator
 * @param {string} [filters.type] - Filter by type
 * @param {string} [filters.priority] - Filter by priority
 * @returns {{ tasks: object[] }}
 */
export function listTasks(projectRoot, filters = {}) {
  const dir = tasksDir(projectRoot);
  if (!existsSync(dir)) return { tasks: [] };

  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'));
  const tasks = [];

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(resolve(dir, file), 'utf-8'));

      if (filters.status && data.status !== filters.status) continue;
      if (
        filters.assignee &&
        !(Array.isArray(data.assignees) && data.assignees.includes(filters.assignee))
      )
        continue;
      if (filters.delegator && data.delegator !== filters.delegator) continue;
      if (filters.type && data.type !== filters.type) continue;
      if (filters.priority && data.priority !== filters.priority) continue;

      tasks.push(data);
    } catch {
      // Skip corrupted task files
    }
  }

  // Sort by priority (P0 first), then by creation date (newest first)
  tasks.sort((a, b) => {
    const paRaw = TASK_PRIORITIES.indexOf(a.priority);
    const pbRaw = TASK_PRIORITIES.indexOf(b.priority);
    const pa = paRaw === -1 ? Number.POSITIVE_INFINITY : paRaw;
    const pb = pbRaw === -1 ? Number.POSITIVE_INFINITY : pbRaw;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return { tasks };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/** Valid state transitions map. */
const VALID_TRANSITIONS = {
  submitted: ['accepted', 'rejected', 'canceled'],
  accepted: ['working', 'rejected', 'canceled'],
  working: ['completed', 'failed', 'input-required', 'canceled'],
  'input-required': ['working', 'canceled'],
  completed: [],
  failed: [],
  rejected: [],
  canceled: [],
};

/**
 * Update a task's status with validation.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} newStatus
 * @param {object} [messageData]
 * @param {string} [messageData.from] - Who is making this change
 * @param {string} [messageData.content] - Optional message content
 * @returns {{ task: object|null, error?: string }}
 */
export function updateTaskStatus(projectRoot, taskId, newStatus, messageData = {}) {
  const result = getTask(projectRoot, taskId);
  if (!result.task) return result;

  const task = result.task;

  if (!TASK_STATES.includes(newStatus)) {
    return { task: null, error: `Invalid status: ${newStatus}. Valid: ${TASK_STATES.join(', ')}` };
  }

  const allowed = VALID_TRANSITIONS[task.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return {
      task: null,
      error: `Invalid transition: ${task.status} → ${newStatus}. Allowed: ${(allowed || []).join(', ') || 'none (terminal state)'}`,
    };
  }

  if (messageData.role && !MESSAGE_ROLES.includes(messageData.role)) {
    return {
      task: null,
      error: `Invalid message role: ${messageData.role}. Valid: ${MESSAGE_ROLES.join(', ')}`,
    };
  }

  const now = new Date().toISOString();
  task.status = newStatus;
  task.updatedAt = now;

  // Add status change message
  if (!Array.isArray(task.messages)) task.messages = [];
  if (messageData.from || messageData.content) {
    task.messages.push({
      role: messageData.role || 'executor',
      from: messageData.from || 'unknown',
      timestamp: now,
      content: messageData.content || `Status changed to ${newStatus}`,
      statusChange: newStatus,
    });
  }

  writeTaskFile(projectRoot, taskId, task);
  return { task };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Add a message to a task.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {object} message
 * @param {string} message.role - 'delegator' or 'executor'
 * @param {string} message.from - Who sent the message
 * @param {string} message.content - Message content
 * @returns {{ task: object|null, error?: string }}
 */
export function addTaskMessage(projectRoot, taskId, message) {
  const result = getTask(projectRoot, taskId);
  if (!result.task) return result;

  if (!MESSAGE_ROLES.includes(message.role)) {
    return {
      task: null,
      error: `Invalid message role: ${message.role}. Valid: ${MESSAGE_ROLES.join(', ')}`,
    };
  }

  const task = result.task;

  if (TERMINAL_STATES.includes(task.status)) {
    return { task: null, error: `Cannot add messages to task in terminal state: ${task.status}` };
  }

  task.messages.push({
    role: message.role,
    from: message.from,
    timestamp: new Date().toISOString(),
    content: message.content,
  });
  task.updatedAt = new Date().toISOString();

  writeTaskFile(projectRoot, taskId, task);
  return { task };
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/**
 * Add an artifact to a task.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {object} artifact
 * @param {string} artifact.type - One of ARTIFACT_TYPES
 * @param {string[]} [artifact.paths] - File paths (for files-changed)
 * @param {string} [artifact.summary] - Summary of the artifact
 * @param {number} [artifact.passed] - Tests passed (for test-results)
 * @param {number} [artifact.failed] - Tests failed (for test-results)
 * @param {number} [artifact.added] - Tests added (for test-results)
 * @returns {{ task: object|null, error?: string }}
 */
export function addTaskArtifact(projectRoot, taskId, artifact) {
  const result = getTask(projectRoot, taskId);
  if (!result.task) return result;

  if (!ARTIFACT_TYPES.includes(artifact.type)) {
    return {
      task: null,
      error: `Invalid artifact type: ${artifact.type}. Valid: ${ARTIFACT_TYPES.join(', ')}`,
    };
  }

  const task = result.task;
  if (!Array.isArray(task.artifacts)) task.artifacts = [];
  task.artifacts.push({
    ...artifact,
    addedAt: new Date().toISOString(),
  });
  task.updatedAt = new Date().toISOString();

  writeTaskFile(projectRoot, taskId, task);
  return { task };
}

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

/**
 * Check all tasks and unblock those whose dependencies have completed.
 * @param {string} projectRoot
 * @returns {{ unblocked: string[], errors: string[] }}
 */
export function checkDependencies(projectRoot) {
  const { tasks } = listTasks(projectRoot);
  const unblocked = [];
  const errors = [];

  for (const task of tasks) {
    if (TERMINAL_STATES.includes(task.status)) continue;
    if (!Array.isArray(task.dependsOn) || task.dependsOn.length === 0) continue;

    const newBlockers = [];
    let hasFailedDep = false;

    for (const depId of task.dependsOn) {
      const dep = getTask(projectRoot, depId);
      if (!dep.task) {
        errors.push(`Task ${task.id}: dependency ${depId} not found`);
        continue;
      }
      if (dep.task.status === 'completed') {
        // Dependency satisfied — don't add to blockers
      } else if (['failed', 'rejected', 'canceled'].includes(dep.task.status)) {
        hasFailedDep = true;
        newBlockers.push(depId);
      } else {
        newBlockers.push(depId);
      }
    }

    const priorBlockers = Array.isArray(task.blockedBy) ? task.blockedBy : [];
    const wasBlocked = priorBlockers.length > 0;
    task.blockedBy = newBlockers;
    const blockersChanged = JSON.stringify(priorBlockers) !== JSON.stringify(newBlockers);
    if (blockersChanged) {
      task.updatedAt = new Date().toISOString();
      writeTaskFile(projectRoot, task.id, task);
    }

    if (wasBlocked && newBlockers.length === 0 && !hasFailedDep) {
      unblocked.push(task.id);
    }
  }

  return { unblocked, errors };
}

// ---------------------------------------------------------------------------
// Handoff processing
// ---------------------------------------------------------------------------

/**
 * Process completed tasks that have handoffTo defined.
 * Creates new tasks for downstream teams.
 * @param {string} projectRoot
 * @param {string} [delegator] - Who to attribute the new tasks to (default: 'orchestrator')
 * @returns {{ created: object[], errors: string[] }}
 */
export function processHandoffs(projectRoot, delegator = 'orchestrator') {
  const { tasks } = listTasks(projectRoot, { status: 'completed' });
  const created = [];
  const errors = [];

  for (const task of tasks) {
    if (!Array.isArray(task.handoffTo) || task.handoffTo.length === 0) continue;

    // Check if handoff already processed (look for a _handoffProcessed flag)
    if (task._handoffProcessed) continue;

    for (const targetTeam of task.handoffTo) {
      const result = createTask(projectRoot, {
        type: task.type || 'implement',
        delegator,
        assignees: [targetTeam],
        title: `[Handoff] ${task.title}`,
        description: task.handoffContext || `Continuation of ${task.id}: ${task.title}`,
        priority: task.priority,
        dependsOn: [],
        scope: task.scope,
        context: {
          ...task.context,
          handoffFrom: task.id,
          handoffFromTeam: task.assignees.join(', '),
          previousArtifacts: task.artifacts,
        },
      });

      if (result.error) {
        errors.push(`Failed to create handoff task for ${targetTeam}: ${result.error}`);
      } else {
        created.push(result.task);
      }
    }

    // Mark handoff as processed
    task._handoffProcessed = true;
    task.updatedAt = new Date().toISOString();
    writeTaskFile(projectRoot, task.id, task);
  }

  return { created, errors };
}

// ---------------------------------------------------------------------------
// Summary / display helpers
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable task summary.
 * @param {object} task
 * @returns {string}
 */
export function formatTaskSummary(task) {
  const safeTask = task && typeof task === 'object' ? task : {};
  const safeAssignees = Array.isArray(safeTask.assignees) ? safeTask.assignees : [];
  const safeDependsOn = Array.isArray(safeTask.dependsOn) ? safeTask.dependsOn : [];
  const safeBlockedBy = Array.isArray(safeTask.blockedBy) ? safeTask.blockedBy : [];
  const safeHandoffTo = Array.isArray(safeTask.handoffTo) ? safeTask.handoffTo : [];
  const safeArtifacts = Array.isArray(safeTask.artifacts) ? safeTask.artifacts : [];
  const safeMessages = Array.isArray(safeTask.messages) ? safeTask.messages : [];
  const lines = [
    `Task: ${safeTask.id || 'unknown'}`,
    `Title: ${safeTask.title || '(untitled)'}`,
    `Type: ${safeTask.type || 'unknown'} | Priority: ${safeTask.priority || 'unknown'} | Status: ${safeTask.status || 'unknown'}`,
    `Delegator: ${safeTask.delegator || 'unknown'} → Assignees: ${safeAssignees.join(', ')}`,
  ];

  if (safeDependsOn.length > 0) {
    lines.push(`Depends on: ${safeDependsOn.join(', ')}`);
  }
  if (safeBlockedBy.length > 0) {
    lines.push(`Blocked by: ${safeBlockedBy.join(', ')}`);
  }
  if (safeHandoffTo.length > 0) {
    lines.push(`Handoff to: ${safeHandoffTo.join(', ')}`);
  }
  if (safeArtifacts.length > 0) {
    lines.push(`Artifacts: ${safeArtifacts.length}`);
  }

  lines.push(`Created: ${safeTask.createdAt || 'unknown'}`);
  lines.push(`Updated: ${safeTask.updatedAt || 'unknown'}`);
  lines.push(`Messages: ${safeMessages.length}`);

  return lines.join('\n');
}

/**
 * Generate a markdown-formatted task list.
 * @param {object[]} tasks
 * @returns {string}
 */
export function formatTaskList(tasks) {
  if (tasks.length === 0) return 'No tasks found.';

  const escapeCell = (value) =>
    String(value ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ');

  const statusIcon = {
    submitted: '📩',
    accepted: '✅',
    working: '🔨',
    'input-required': '❓',
    completed: '✔️',
    failed: '❌',
    rejected: '🚫',
    canceled: '🗑️',
  };

  const lines = [
    '| ID | Priority | Status | Type | Title | Assignees |',
    '|----|----------|--------|------|-------|-----------|',
  ];

  for (const task of tasks) {
    const icon = statusIcon[task?.status] || '?';
    const assignees = Array.isArray(task?.assignees) ? task.assignees.join(', ') : '';
    lines.push(
      `| ${escapeCell(task?.id)} | ${escapeCell(task?.priority)} | ${escapeCell(`${icon} ${task?.status || 'unknown'}`)} | ${escapeCell(task?.type)} | ${escapeCell(task?.title)} | ${escapeCell(assignees)} |`
    );
  }

  return lines.join('\n');
}
