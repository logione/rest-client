import { appendSearchToURL } from './search.js'
import { hasHeader, setHeader } from './headers.js'
import { RequestError } from './request-error.js'
import { RequestOptions } from './request-options.js'

const isNode = typeof (globalThis as { process?: { versions?: { node?: unknown } } }).process?.versions?.node === 'string'

export async function get(url: string, options?: RequestOptions<undefined>): Promise<Response> {
    return request('GET', url, options)
}

export async function del(url: string, options?: RequestOptions<undefined>): Promise<Response> {
    return request('DELETE', url, options)
}

export async function post(url: string, options?: RequestOptions<BodyInit>): Promise<Response> {
    return request('POST', url, options)
}

export async function put(url: string, options?: RequestOptions<BodyInit>): Promise<Response> {
    return request('PUT', url, options)
}

export async function request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, options: RequestOptions<BodyInit | undefined> = {}): Promise<Response> {
    const headers: Record<string, string> = { ...options.headers }
    if (isNode && !hasHeader(headers, 'User-Agent')) {
        headers['User-Agent'] = 'node'
    }

    const requestInit: RequestInit = {
        headers,
        method
    }
    
    if (options.body !== undefined) {
        requestInit.body = options.body
    }
    if (options.signal) {
        requestInit.signal = options.signal
    }
    if (options.credentials) {
        requestInit.credentials = options.credentials
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