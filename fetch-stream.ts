import { ClientRequest, IncomingMessage, RequestOptions as HTTPRequestOptions, IncomingHttpHeaders } from 'http'
import { pipeline } from 'stream/promises'

import { RequestError } from './request-error'
import { RequestOptions } from './request-options'
import { appendSearchToURL } from './search'

export async function getStream(url: string, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
    url = appendSearchToURL(url, options?.search)
    const { protocol, httpRequestOptions } = getHTTPRequestOptions('GET', url, options)
    const request = await importHttpRequest(protocol)
    return new Promise<IncomingMessage>((resolve, reject) => {
        const req = request(httpRequestOptions, (response) => {
            if (!response.statusCode) {
                reject(new Error('No status code'))
            } else if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new RequestError(response.statusMessage || '', response.statusCode, getHeaders(response.headers), response))
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

export async function postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
    return postOrPutStream('POST', url, readableStream, options)
}

export async function putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
    return postOrPutStream('PUT', url, readableStream, options)
}

async function postOrPutStream(method: 'POST' | 'PUT', url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
    url = appendSearchToURL(url, options?.search)
    const { protocol, httpRequestOptions } = getHTTPRequestOptions(method, url, options)
    const request = await importHttpRequest(protocol)
    let req: ClientRequest | undefined
    const promise = new Promise<IncomingMessage>((resolve, reject) => {
        req = request(httpRequestOptions, (response) => {
            if (!response.statusCode) {
                reject(new Error('No status code'))
            } else if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new RequestError(response.statusMessage || '', response.statusCode, getHeaders(response.headers), response))
            } else {
                resolve(response)
            }
        })
    })
    await pipeline(readableStream, req!)
    return promise
}

function getHeaders(incomingHttpHeaders: IncomingHttpHeaders): Headers {
    const headers = new Headers()
    for (const key in incomingHttpHeaders) {
        if (incomingHttpHeaders.hasOwnProperty(key)) {
            const value = incomingHttpHeaders[key]
            if (Array.isArray(value)) {
                for (const v of value) {
                    headers.append(key, v)
                }
            } else {
                headers.append(key, value ?? '')
            }
        }
    }
    return headers
}

function getHTTPRequestOptions(method: 'GET' | 'POST' | 'PUT', url: string, options: RequestOptions<undefined> = {}): { protocol: string, httpRequestOptions: HTTPRequestOptions } {
    const urlParsed = new URL(url)
    const headers = options.headers || {}
    headers['User-Agent'] = headers['User-Agent'] || 'node'
    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`
    }
    const httpRequestOptions: HTTPRequestOptions = {
        hostname: urlParsed.hostname,
        port: urlParsed.port ? +urlParsed.port : (urlParsed.protocol === 'http:' ? 80 : 443),
        path: `${urlParsed.pathname}${urlParsed.search}`,
        method,
        headers
    }
    return { protocol: urlParsed.protocol, httpRequestOptions }
}

async function importHttpRequest(protocol: string) {
    const { request }= await (protocol === 'https:' ? import('https') : import('http'))
    return request
}
