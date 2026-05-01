// leadpilot/instrumentation.ts
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const { cronService } = await import('./lib/services/CronService');
      cronService.init();
    }
  }