import type { HttpMethod } from './fetch.js'

export interface RetryOptions {
    /** Attempts after the first one. */
    limit: number
    /** Methods that are retried. Default: GET, HEAD, PUT and DELETE, which are safe to send twice. */
    methods?: HttpMethod[]
    /** Response statuses that are retried. Default: 408, 429, 500, 502, 503 and 504. Network errors are always retried. */
    statusCodes?: number[]
    /** Milliseconds before the first retry, doubled for each next one. Default: 300. */
    delay?: number
    /** Longest wait between attempts, in milliseconds. A longer `Retry-After` gives up instead. Default: 30000. */
    maxDelay?: number
}

/** The retry settings of a request, all set. A `limit` of 0 means no retry. */
export interface Retry {
    limit: number
    statusCodes: number[]
    delay: number
    maxDelay: number
}

const DEFAULT_METHODS: HttpMethod[] = ['GET', 'HEAD', 'PUT', 'DELETE']
const DEFAULT_STATUS_CODES = [408, 429, 500, 502, 503, 504]

/** The retry settings of a request with `method`, from the `retry` option (a number is the limit). */
export function getRetry(retry: number | RetryOptions | undefined, method: HttpMethod): Retry {
    const options = typeof retry === 'number' ? { limit: retry } : retry
    const methods = options?.methods ?? DEFAULT_METHODS
    return {
        limit: options && methods.includes(method) ? Math.max(0, Math.floor(options.limit)) : 0,
        statusCodes: options?.statusCodes ?? DEFAULT_STATUS_CODES,
        delay: options?.delay ?? 300,
        maxDelay: options?.maxDelay ?? 30000
    }
}

/**
 * Milliseconds to wait before attempt `attempt + 1`: the `Retry-After` header of the response when it has one,
 * else a delay doubled at each attempt, with some randomness so that clients don't all retry at once.
 * Undefined when the server asks to wait longer than maxDelay.
 */
export function getRetryDelay(retry: Retry, attempt: number, response?: Response): number | undefined {
    const retryAfter = parseRetryAfter(response?.headers.get('retry-after'))
    if (retryAfter !== undefined) {
        return retryAfter <= retry.maxDelay ? retryAfter : undefined
    }
    const delay = Math.min(retry.delay * 2 ** attempt, retry.maxDelay)
    return delay / 2 + Math.random() * delay / 2
}

/** `Retry-After` is a number of seconds or an HTTP date. */
function parseRetryAfter(value: string | null | undefined): number | undefined {
    if (!value) {
        return undefined
    }
    if (/^\s*\d+(\.\d+)?\s*$/.test(value)) {
        return Number(value) * 1000
    }
    const date = Date.parse(value)
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

/** Waits `ms` milliseconds, or rejects with the abort reason as soon as `signal` aborts. */
export function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason)
            return
        }
        const onAbort = () => {
            clearTimeout(timer)
            reject(signal!.reason)
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort)
            resolve()
        }, ms)
        signal?.addEventListener('abort', onAbort, { once: true })
    })
}
