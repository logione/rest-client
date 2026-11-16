import { RequestOptions } from './request-options.js'

/** Timers fire at once above this delay (2^31 - 1 ms, about 24.8 days) instead of waiting. */
const MAX_TIMEOUT = 2 ** 31 - 1

/** Combines the signal and timeout options into the single signal given to the request. */
export function getSignal(options: RequestOptions<unknown> | undefined): AbortSignal | undefined {
    const timeout = options?.timeout
    if (timeout === undefined || timeout === null || timeout === Infinity) {
        return options?.signal
    }
    if (typeof timeout !== 'number' || Number.isNaN(timeout) || timeout < 0) {
        throw new RangeError(`timeout must be a number of milliseconds >= 0, Infinity or null, got ${timeout}`)
    }
    // AbortSignal.timeout only accepts whole milliseconds.
    const timeoutSignal = AbortSignal.timeout(Math.min(Math.ceil(timeout), MAX_TIMEOUT))
    return options?.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal
}
