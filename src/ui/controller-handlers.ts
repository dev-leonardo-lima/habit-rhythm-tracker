import type { DashboardController } from './dashboard-controller';
import type { DashboardHandlers } from './dashboard-renderer';

export function createDashboardHandlers(controller: DashboardController): DashboardHandlers {
  return {
    createHabit: (name, target) => controller.createHabit(name, target),
    toggleCompletion: (habitId, date, completed) =>
      controller.toggleCompletion(habitId, date, completed),
    renameHabit: (habitId, name) => controller.renameHabit(habitId, name),
    changeColor: (habitId, color) => controller.changeColor(habitId, color),
    changeTarget: (habitId, target) => controller.changeTarget(habitId, target),
    archiveHabit: (habitId) => controller.archiveHabit(habitId),
    reactivateHabit: (habitId) => controller.reactivateHabit(habitId),
    cancelPendingArchive: (habitId) => controller.cancelPendingArchive(habitId),
    previousMonth: () => controller.previousMonth(),
    nextMonth: () => controller.nextMonth(),
    previousWeek: () => controller.previousWeek(),
    nextWeek: () => controller.nextWeek(),
  };
}
