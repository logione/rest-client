import { request } from './fetch'
import { RequestOptions } from './request-options'

export function getJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T> {
    return requestJSON<T>('GET', url, options)
}

export function deleteJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T> {
    return requestJSON<T>('DELETE', url, options)
}

export function putJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T> {
    return requestJSON<T>('PUT', url, options)
}

export function postJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T> {
    return requestJSON<T>('POST', url, options)
}

async function requestJSON<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, options: RequestOptions<unknown> = {}): Promise<T> {
    options.headers = options.headers || {}
    options.headers.Accept = 'application/json'

    if (options.body) {
        options.headers['Content-Type'] = 'application/json'
        if (typeof options.body !== 'string') {
            options.body = JSON.stringify(options.body)
        }
    }
    const result = await request(method, url, options as RequestOptions<string>)
    const contentType = result.headers.get('content-type')
    if (contentType && contentType.startsWith('application/json')) {
        return result.json()
    }
    return result.text() as any
}