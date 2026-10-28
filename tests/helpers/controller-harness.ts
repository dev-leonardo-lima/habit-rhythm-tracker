import { DashboardController } from '../../src/ui/dashboard-controller';
import { HabitRepository } from '../../src/storage/habit-repository';
import { GuardedCreator, GuardedWriter } from '../../src/storage/guarded-write';
import { RecoveryService } from '../../src/storage/recovery-service';
import { RecoveryStore } from '../../src/storage/recovery-store';
import { MemoryVault } from './memory-vault';

export interface HarnessOptions {
  now: () => Date;
  confirm?: (message: string) => Promise<boolean>;
  vault?: MemoryVault;
  habitsFolder?: string;
  recoveryFolder?: string;
}

export function createHarness(options: HarnessOptions) {
  const vault = options.vault ?? new MemoryVault();
  vault.folders.add(options.habitsFolder ?? 'Habits');
  vault.folders.add(options.recoveryFolder ?? 'Recovery');
  const habitsFolder = options.habitsFolder ?? 'Habits';
  const recoveryFolder = options.recoveryFolder ?? 'Recovery';
  const repository = new HabitRepository(vault, habitsFolder);
  const recoveryStore = new RecoveryStore({
    vault,
    folder: recoveryFolder,
    now: options.now,
  });
  const writer = new GuardedWriter({
    vault,
    recoveryStore,
    now: options.now,
  });
  const creator = new GuardedCreator({
    vault,
    recoveryStore,
    now: options.now,
  });
  const recoveryService = new RecoveryService({
    vault,
    store: recoveryStore,
    writer,
    creator,
    now: options.now,
  });
  const controller = new DashboardController({
    repository,
    writer,
    creator,
    recoveryService,
    now: options.now,
    confirm: options.confirm,
  });
  return {
    vault,
    repository,
    recoveryStore,
    writer,
    creator,
    recoveryService,
    controller,
    habitsFolder,
    recoveryFolder,
  };
}

export function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
