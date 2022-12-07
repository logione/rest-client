import { RequestError } from './request-error'
import { RequestOptions } from './request-options'

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
    const headers = options.headers || {}
    headers['User-Agent'] = headers['User-Agent'] || 'node'

    const requestInit: RequestInit = {
        headers,
        method
    }
    
    if (options.body) {
        requestInit.body = options.body
    }

    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`
    }

    const result = await fetch(url, requestInit)
    if (!result.ok) {
        throw new RequestError(result.statusText, result.status)
    }
    return result
}