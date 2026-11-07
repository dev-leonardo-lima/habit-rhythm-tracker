import type { DashboardController } from './dashboard-controller';
import type { DashboardHandlers } from './dashboard-renderer';

export function createDashboardHandlers(
  controller: DashboardController,
  openHabit: DashboardHandlers['openHabit'] = () => undefined,
  beforeAction: () => void = () => undefined,
): DashboardHandlers {
  return {
    createHabit: (name, target) => {
      beforeAction();
      return controller.createHabit(name, target);
    },
    toggleCompletion: (id, date, completed) => {
      beforeAction();
      return controller.toggleCompletion(id, date, completed);
    },
    openHabit,
    previousWeek: () => {
      beforeAction();
      controller.previousWeek();
    },
    nextWeek: () => {
      beforeAction();
      controller.nextWeek();
    },
  };
}
