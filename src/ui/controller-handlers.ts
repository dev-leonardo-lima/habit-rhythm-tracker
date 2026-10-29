import type { DashboardController } from './dashboard-controller';
import type { DashboardHandlers } from './dashboard-renderer';

export function createDashboardHandlers(controller: DashboardController): DashboardHandlers {
  return {
    createHabit: (name, target) => controller.createHabit(name, target),
    toggleCompletion: (habitId, date, completed) =>
      controller.toggleCompletion(habitId, date, completed),
    toggleHabitHistory: (habitId) => controller.toggleHabitHistory(habitId),
    closeHabitHistory: () => controller.closeHabitHistory(),
    changeHistoryYear: (delta) => controller.changeHistoryYear(delta),
    renameHabit: (habitId, name) => controller.renameHabit(habitId, name),
    changeColor: (habitId, color) => controller.changeColor(habitId, color),
    changeIcon: (habitId, icon) => controller.changeIcon(habitId, icon),
    changeTarget: (habitId, target) => controller.changeTarget(habitId, target),
    archiveHabit: (habitId) => controller.archiveHabit(habitId),
    reactivateHabit: (habitId) => controller.reactivateHabit(habitId),
    cancelPendingArchive: (habitId) => controller.cancelPendingArchive(habitId),
    previousWeek: () => controller.previousWeek(),
    nextWeek: () => controller.nextWeek(),
  };
}
