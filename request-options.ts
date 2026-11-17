import { HeadersOption } from './headers.js'
import { RetryOptions } from './retry.js'
import { Search } from './search.js'
import { StandardSchemaV1 } from './standard-schema.v1.js'

export interface RequestOptions<T> {
    token?: string
    headers?: HeadersOption
    body?: T | undefined
    search?: Search
    signal?: AbortSignal
    /** Milliseconds before the request is aborted. `null` or `Infinity` means no timeout. */
    timeout?: number | null
    credentials?: 'omit' | 'same-origin' | 'include'
    /**
     * Sends the request again after a network error or a 408, 429, 500, 502, 503 or 504 response:
     * the number of retries, or the retry options. Only GET, HEAD, PUT and DELETE by default, never
     * with a stream body. The timeout covers all the attempts.
     */
    retry?: number | RetryOptions
}

export interface RequestOptionsWithSchema<T, S extends StandardSchemaV1> extends RequestOptions<T> {
    schema: S
}