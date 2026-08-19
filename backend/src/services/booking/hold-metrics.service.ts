import type { Response } from 'express';
import { performance } from 'node:perf_hooks';
import {
    holdPhaseMetricsEnabled,
    recordHoldPhaseMetric,
} from '../runtime-metrics.service';

const holdPhases = [
    'validationDataLookup',
    'redisLuaHold',
    'mongoOrderCreation',
    'summaryStatusUpdates',
    'bullExpirationEnqueue',
    'requestItemNormalization',
    'availabilityBusinessRules',
    'ticketPriceConstruction',
    'redisKeyArgumentConstruction',
    'postHoldStatePreparation',
    'logging',
    'responseObjectConstruction',
    'responseSerializationDispatch',
] as const;

export type HoldPhase = typeof holdPhases[number];

/**
 * Benchmark-only accounting for the hold workflow. It deliberately keeps the
 * established metric names so performance comparisons remain continuous while
 * orchestration moves out of the HTTP controller.
 */
export class HoldMetrics {
    readonly enabled = holdPhaseMetricsEnabled();
    private readonly startedAt = this.enabled ? performance.now() : 0;
    private readonly durations: Record<HoldPhase, number> = Object.fromEntries(
        holdPhases.map(phase => [phase, 0]),
    ) as Record<HoldPhase, number>;
    private readonly syncCpuDurations: Partial<Record<HoldPhase, number>> = {};

    async measure<T>(phase: HoldPhase, operation: () => Promise<T>): Promise<T> {
        if (!this.enabled) return operation();
        const startedAt = performance.now();
        try {
            return await operation();
        } finally {
            this.durations[phase] += performance.now() - startedAt;
        }
    }

    measureSync<T>(phase: HoldPhase, operation: () => T): T {
        if (!this.enabled) return operation();
        const startedAt = performance.now();
        const startedCpu = process.cpuUsage();
        try {
            return operation();
        } finally {
            this.durations[phase] += performance.now() - startedAt;
            const cpu = process.cpuUsage(startedCpu);
            this.syncCpuDurations[phase] = (this.syncCpuDurations[phase] || 0)
                + (cpu.user + cpu.system) / 1_000;
        }
    }

    recordOnSuccess(response: Response): void {
        if (!this.enabled) return;
        response.once('finish', () => {
            for (const [phase, durationMs] of Object.entries(this.durations)) {
                recordHoldPhaseMetric(phase, durationMs);
            }
            for (const [phase, durationMs] of Object.entries(this.syncCpuDurations)) {
                recordHoldPhaseMetric(`syncCpu.${phase}`, durationMs);
            }
            recordHoldPhaseMetric(
                'syncCpu.accountedTotal',
                Object.values(this.syncCpuDurations).reduce((total, duration) => total + (duration || 0), 0),
            );
            const measuredDuration = Object.values(this.durations)
                .reduce((total, duration) => total + duration, 0);
            recordHoldPhaseMetric(
                'remainingControllerOverhead',
                Math.max(0, performance.now() - this.startedAt - measuredDuration),
            );
        });
    }
}
