import type { RubricCommand } from '@/features/rubric-tab/domain';

type UpdateRubricFn = (operation: RubricCommand) => Promise<void>;

export class RubricUpdateQueue {
  private readonly pendingOperations = new Map<string, RubricCommand>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly delayMs: number;
  private readonly updateRubric: UpdateRubricFn;

  constructor(updateRubric: UpdateRubricFn, delayMs = 300) {
    this.updateRubric = updateRubric;
    this.delayMs = delayMs;
  }

  schedule(operationKey: string, operation: RubricCommand): void {
    this.pendingOperations.set(operationKey, operation);
    const existingTimer = this.timers.get(operationKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      const pendingOperation = this.pendingOperations.get(operationKey);
      this.pendingOperations.delete(operationKey);
      this.timers.delete(operationKey);
      if (!pendingOperation) {
        return;
      }
      void this.updateRubric(pendingOperation);
    }, this.delayMs);

    this.timers.set(operationKey, timer);
  }

  async flush(): Promise<void> {
    const operations = Array.from(this.pendingOperations.values());
    this.pendingOperations.clear();

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    for (const operation of operations) {
      await this.updateRubric(operation);
    }
  }
}
