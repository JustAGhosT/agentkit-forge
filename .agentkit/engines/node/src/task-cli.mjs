/**
 * AgentKit Forge — Task CLI Handlers
 * CLI entry points for the task delegation protocol.
 */
import {
  createTask, getTask, listTasks, formatTaskSummary, formatTaskList,
  checkDependencies, processHandoffs,
  TASK_TYPES, TASK_PRIORITIES, TASK_STATES,
} from './task-protocol.mjs';

/**
 * List and inspect delegated tasks.
 * Flags: --status, --assignee, --type, --priority, --id
 */
export async function runTasks({ projectRoot, flags }) {
  // Single task detail
  if (flags.id) {
    const result = getTask(projectRoot, flags.id);
    if (result.error) {
      console.error(`[agentkit:tasks] ${result.error}`);
      process.exit(1);
    }
    console.log(formatTaskSummary(result.task));
    if (result.task.messages.length > 0) {
      console.log('\n--- Messages ---');
      for (const msg of result.task.messages) {
        console.log(`  [${msg.timestamp}] ${msg.role}/${msg.from}: ${msg.content}`);
      }
    }
    if (result.task.artifacts.length > 0) {
      console.log('\n--- Artifacts ---');
      for (const art of result.task.artifacts) {
        console.log(`  ${art.type}: ${art.summary || JSON.stringify(art)}`);
      }
    }
    return;
  }

  // Check dependencies and process handoffs before listing
  const depResult = checkDependencies(projectRoot);
  if (depResult.unblocked.length > 0) {
    console.log(`[agentkit:tasks] Unblocked ${depResult.unblocked.length} task(s): ${depResult.unblocked.join(', ')}`);
  }

  const handoffResult = processHandoffs(projectRoot);
  if (handoffResult.created.length > 0) {
    console.log(`[agentkit:tasks] Created ${handoffResult.created.length} handoff task(s)`);
  }

  // List with filters
  const filters = {};
  if (flags.status) filters.status = flags.status;
  if (flags.assignee) filters.assignee = flags.assignee;
  if (flags.type) filters.type = flags.type;
  if (flags.priority) filters.priority = flags.priority;

  const { tasks } = listTasks(projectRoot, filters);
  if (tasks.length === 0) {
    console.log('[agentkit:tasks] No tasks found.');
    return;
  }

  console.log(formatTaskList(tasks));
  console.log(`\nTotal: ${tasks.length} task(s)`);
}

/**
 * Create a delegated task.
 * Flags: --to, --title, --description, --type, --priority, --depends-on, --handoff-to, --scope
 */
export async function runDelegate({ projectRoot, flags }) {
  if (!flags.to) {
    console.error('[agentkit:delegate] --to <team> is required');
    process.exit(1);
  }
  if (!flags.title) {
    console.error('[agentkit:delegate] --title <text> is required');
    process.exit(1);
  }

  const taskData = {
    delegator: 'cli',
    assignees: flags.to.split(',').map(s => s.trim()),
    title: flags.title,
    description: flags.description || '',
    type: flags.type || 'implement',
    priority: flags.priority || 'P2',
    dependsOn: flags['depends-on'] ? flags['depends-on'].split(',').map(s => s.trim()) : [],
    handoffTo: flags['handoff-to'] ? flags['handoff-to'].split(',').map(s => s.trim()) : [],
    scope: flags.scope ? flags.scope.split(',').map(s => s.trim()) : [],
  };

  const result = createTask(projectRoot, taskData);
  if (result.error) {
    console.error(`[agentkit:delegate] ${result.error}`);
    process.exit(1);
  }

  console.log(`[agentkit:delegate] Task created: ${result.task.id}`);
  console.log(formatTaskSummary(result.task));
}
