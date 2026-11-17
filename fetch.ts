import { appendSearchToURL } from './search.js'
import { hasHeader, setHeader, toHeaderRecord } from './headers.js'
import { RequestError } from './request-error.js'
import { RequestOptions } from './request-options.js'
import { getSignal } from './signal.js'

/** A fetch body, or in Node.js any async iterable such as a stream.Readable. */
export type RequestBody = BodyInit | AsyncIterable<Uint8Array>
export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const isNode = typeof (globalThis as { process?: { versions?: { node?: unknown } } }).process?.versions?.node === 'string'

export async function get(url: string, options?: RequestOptions<undefined>): Promise<Response> {
    return request('GET', url, options)
}

export async function head(url: string, options?: RequestOptions<undefined>): Promise<Response> {
    return request('HEAD', url, options)
}

export async function del(url: string, options?: RequestOptions<undefined>): Promise<Response> {
    return request('DELETE', url, options)
}

export async function post(url: string, options?: RequestOptions<RequestBody>): Promise<Response> {
    return request('POST', url, options)
}

export async function put(url: string, options?: RequestOptions<RequestBody>): Promise<Response> {
    return request('PUT', url, options)
}

export async function patch(url: string, options?: RequestOptions<RequestBody>): Promise<Response> {
    return request('PATCH', url, options)
}

/** `redirect` 'manual' returns a 3xx response as is (a RequestError) instead of following it. */
export async function request(method: HttpMethod, url: string, options: RequestOptions<RequestBody | undefined> = {}, redirect?: RequestRedirect): Promise<Response> {
    const headers = toHeaderRecord(options.headers)
    if (isNode && !hasHeader(headers, 'User-Agent')) {
        headers['User-Agent'] = 'node'
    }

    const requestInit: RequestInit = {
        headers,
        method
    }
    
    if (options.body !== undefined) {
        // Node.js fetch accepts async iterables, but its BodyInit type does not list them.
        requestInit.body = options.body as BodyInit
        if (isStreamBody(options.body)) {
            // fetch requires duplex 'half' to send a stream body (missing from the DOM RequestInit type).
            (requestInit as RequestInit & { duplex?: 'half' }).duplex = 'half'
        }
    }
    const signal = getSignal(options)
    if (signal) {
        requestInit.signal = signal
    }
    if (options.credentials) {
        requestInit.credentials = options.credentials
    }
    if (redirect) {
        requestInit.redirect = redirect
    }

    if (options.token) {
        setHeader(headers, 'Authorization', `Bearer ${options.token}`)
    }

    url = appendSearchToURL(url, options.search)
    const result = await fetch(url, requestInit)
    if (!result.ok) {
        throw new RequestError(result.statusText, result.status, result.headers, result)
    }
    return result
}

/** A web ReadableStream, or in Node.js any async iterable (such as a stream.Readable), which fetch also accepts. */
export function isStreamBody(body: unknown): boolean {
    if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
        return true
    }
    return typeof body === 'object' && body !== null && Symbol.asyncIterator in body
}
