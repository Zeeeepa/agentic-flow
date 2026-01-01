/**
 * Warning Suppression Utilities
 *
 * Suppresses noisy warnings like ExperimentalWarning for WASM imports
 * while preserving important warnings.
 */

let warningsSetup = false;

/**
 * Suppress experimental warnings for WASM module imports
 */
export function suppressExperimentalWarnings(): void {
  if (warningsSetup) return;
  warningsSetup = true;

  const originalEmit = process.emit.bind(process);

  // @ts-ignore - Override emit to filter warnings
  process.emit = function (event: string, ...args: any[]): boolean {
    if (event === 'warning') {
      const warning = args[0];
      if (warning && typeof warning === 'object') {
        const name = (warning as any).name;
        const message = (warning as any).message || '';

        // Suppress ExperimentalWarning for import assertions/attributes
        if (name === 'ExperimentalWarning') {
          if (message.includes('Import') ||
              message.includes('import.meta') ||
              message.includes('--experimental')) {
            return false;
          }
        }

        // Suppress noisy deprecation warnings from dependencies
        if (name === 'DeprecationWarning') {
          if (message.includes('punycode') ||
              message.includes('Buffer()')) {
            return false;
          }
        }
      }
    }

    return originalEmit(event, ...args);
  };
}

/**
 * Run a function with warnings suppressed
 */
export async function withSuppressedWarnings<T>(fn: () => Promise<T>): Promise<T> {
  suppressExperimentalWarnings();
  return fn();
}

/**
 * Import a module with experimental warnings suppressed
 */
export async function quietImport<T>(modulePath: string): Promise<T> {
  suppressExperimentalWarnings();
  return import(modulePath) as Promise<T>;
}

// Auto-setup on module load
suppressExperimentalWarnings();
