import { DashboardController } from '../../src/ui/dashboard-controller';
import { HabitRepository } from '../../src/storage/habit-repository';
import { GuardedCreator, GuardedWriter } from '../../src/storage/guarded-write';
import { MemoryVault } from './memory-vault';

export interface HarnessOptions {
  now: () => Date;
  vault?: MemoryVault;
  habitsFolder?: string;
}

export function createHarness(options: HarnessOptions) {
  const vault = options.vault ?? new MemoryVault();
  const habitsFolder = options.habitsFolder ?? 'Habits';
  vault.folders.add(habitsFolder);
  const repository = new HabitRepository(vault, habitsFolder);
  const writer = new GuardedWriter({ vault });
  const creator = new GuardedCreator({ vault });
  const controller = new DashboardController({
    repository,
    writer,
    creator,
    now: options.now,
  });
  return {
    vault,
    repository,
    writer,
    creator,
    controller,
    habitsFolder,
  };
}

export function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
