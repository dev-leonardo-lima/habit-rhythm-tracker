import type { DashboardController } from './dashboard-controller';
import type { DashboardHandlers } from './dashboard-renderer';

export function createDashboardHandlers(controller: DashboardController): DashboardHandlers {
  return {
    createHabit: (name, target) => controller.createHabit(name, target),
    toggleCompletion: (habitId, date, completed) =>
      controller.toggleCompletion(habitId, date, completed),
    undoUnmark: (habitId) => controller.undoLastUnmark(habitId),
    renameHabit: (habitId, name) => controller.renameHabit(habitId, name),
    changeTarget: (habitId, target) => controller.changeTarget(habitId, target),
    archiveHabit: (habitId) => controller.archiveHabit(habitId),
    reactivateHabit: (habitId) => controller.reactivateHabit(habitId),
    cancelPendingArchive: (habitId) => controller.cancelPendingArchive(habitId),
    retryRecovery: (operationId) => controller.retryRecovery(operationId),
    discardRecovery: (operationId) => controller.discardRecovery(operationId),
    restoreRecovery: (operationId) => controller.restoreRecovery(operationId),
    deleteRecovery: (operationIds) => controller.deleteRecovery(operationIds),
    previousMonth: () => controller.previousMonth(),
    nextMonth: () => controller.nextMonth(),
    previousWeek: () => controller.previousWeek(),
    nextWeek: () => controller.nextWeek(),
    goToCurrent: () => controller.goToCurrent(),
    setShowArchived: (value) => controller.setShowArchived(value),
    refresh: () => controller.refresh(),
  };
}
