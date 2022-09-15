import type { IncomingMessage, RequestOptions, ClientRequest } from 'http'
import { pipeline } from 'stream/promises'

export function get<T>(url: string, token?: string): Promise<T> {
    return requestJSON<T>(url, 'get', token)
}

export function del<T>(url: string, token?: string): Promise<T> {
    return requestJSON<T>(url, 'delete', token)
}

export function post<T>(url: string, body: unknown, token?: string): Promise<T> {
    return requestJSON<T>(url, 'post', token, JSON.stringify(body))
}

export function put<T>(url: string, body: unknown, token?: string): Promise<T> {
    return requestJSON<T>(url, 'put', token, JSON.stringify(body))
}
    
export async function getStream(url: string, token?: string): Promise<IncomingMessage> {
    const { protocol, options } = getRequestOptions(url, 'GET', token)
    const request = await importHttpRequest(protocol)
    return new Promise<IncomingMessage>((resolve, reject) => {
        const req = request(options, (response) => {
            if (!response.statusCode) {
                reject('No status code')
            } else if (response.statusCode < 200 || response.statusCode > 299) {
                reject(response.statusCode)
            } else {
                resolve(response)
            }
        })
        req.on('error', (err) => {
            reject(err)
        })
        req.end()
    })
}

export async function postStream(url: string, readableStream: NodeJS.ReadableStream, token?: string, headers?: any): Promise<void> {
    return postOrPutStream('POST', url, readableStream, token, headers)
}

export async function putStream(url: string, readableStream: NodeJS.ReadableStream, token?: string, headers?: any): Promise<void> {
    return postOrPutStream('PUT', url, readableStream, token, headers)
}

async function importHttpRequest(protocol: string) {
    const { request }= await (protocol === 'https:' ? import('https') : import('http'))
    return request
}

async function postOrPutStream(method: 'POST' | 'PUT', url: string, readableStream: NodeJS.ReadableStream, token?: string, headers: any = {}) {
    const { protocol, options } = getRequestOptions(url, method, token, headers)
    const request = await importHttpRequest(protocol)
    let req: ClientRequest | undefined
    const promise = new Promise<void>((resolve, reject) => {
        req = request(options, (response) => {
            if (!response.statusCode) {
                reject('No status code')
            } else if (response.statusCode < 200 || response.statusCode > 299) {
                reject(response.statusCode)
            } else {
                resolve()
            }
        })
        req.on('error', (err) => {
            reject(err)
        })
    })
    await pipeline(readableStream, req!)
    return promise
}

function getRequestInit(method: string, token?: string, body?: string | ReadableStream, headers: Record<string, string> = {}): RequestInit {
    initHeaders(token, headers)
    const options: RequestInit = { headers, method }
    if (body) {
        if (typeof body === 'string') {
            headers['content-type'] = 'application/json'
        }
        options.body = body
    }

    return options
}

function getRequestOptions(url: string, method: string, token?: string, headers: Record<string, string> = {}): { protocol: string, options: RequestOptions } {
    const urlParsed = new URL(url)
    const options: RequestOptions = {
        hostname: urlParsed.hostname,
        port: urlParsed.port ? +urlParsed.port : (urlParsed.protocol === 'http:' ? 80 : 443),
        path: `${urlParsed.pathname}${urlParsed.search}`,
        method,
        headers: initHeaders(token, headers)
    }
    return { protocol: urlParsed.protocol, options }
}

async function request(url: string, method: string, token?: string, body?: string | ReadableStream, headers: Record<string, string> = {}): Promise<Response> {
    const result = await fetch(url, getRequestInit(method, token, body, headers))
    if (!result.ok) {
        throw result.status
    }
    return result
}

async function requestJSON<T>(url: string, method: string, token?: string, body?: string | ReadableStream, headers: Record<string, string> = {}): Promise<T> {
    headers.accept = 'application/json'
    const response = await request(url, method, token, body, headers)
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.startsWith('application/json')) {
        return response.json()
    }
    return response.text() as any
}

function initHeaders(token?: string, headers: Record<string, string> = {}): Record<string, string> {
    headers['user-agent'] = 'node'
    if (token) {
        headers.authorization = `Bearer ${token}`
    }
    return headers
}

