import { RequestOptions } from './request-options.js'

/** Combines the signal and timeout options into the single signal given to the request. */
export function getSignal(options: RequestOptions<unknown> | undefined): AbortSignal | undefined {
    const timeout = options?.timeout
    if (timeout === undefined) {
        return options?.signal
    }
    if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 0) {
        throw new RangeError(`timeout must be a finite number of milliseconds >= 0, got ${timeout}`)
    }
    const timeoutSignal = AbortSignal.timeout(timeout)
    return options?.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal
}
