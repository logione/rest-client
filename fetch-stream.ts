import { ClientRequest, IncomingMessage, RequestOptions as HTTPRequestOptions, IncomingHttpHeaders } from 'http'
import { pipeline } from 'stream/promises'

import { RequestError } from './request-error.js'
import { RequestOptions } from './request-options.js'
import { appendSearchToURL } from './search.js'
import { hasHeader, setHeader } from './headers.js'

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
    const req = request(httpRequestOptions)
    const responsePromise = waitForResponse(req)
    const [upload, response] = await Promise.allSettled([pipeline(readableStream, req), responsePromise])
    if (response.status === 'rejected') {
        if (response.reason instanceof RequestError || upload.status === 'fulfilled') {
            throw response.reason
        }
        throw upload.reason
    }
    if (upload.status === 'rejected') {
        response.value.destroy()
        throw upload.reason
    }
    return response.value
}

function waitForResponse(req: ClientRequest): Promise<IncomingMessage> {
    return new Promise<IncomingMessage>((resolve, reject) => {
        req.once('response', (response) => {
            if (!response.statusCode) {
                reject(new Error('No status code'))
            } else if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new RequestError(response.statusMessage || '', response.statusCode, getHeaders(response.headers), response))
            } else {
                resolve(response)
            }
        })
        req.once('error', reject)
        req.once('close', () => reject(new Error('Request closed before a response was received')))
    })
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
    // Copy so the defaults and token added below never leak into the caller's object.
    const headers: Record<string, string> = { ...options.headers }
    if (!hasHeader(headers, 'User-Agent')) {
        headers['User-Agent'] = 'node'
    }
    if (options.token) {
        setHeader(headers, 'Authorization', `Bearer ${options.token}`)
    }
    const httpRequestOptions: HTTPRequestOptions = {
        // URL keeps the brackets of IPv6 hosts ([::1]) but http.request expects them without.
        hostname: urlParsed.hostname.replace(/^\[(.*)\]$/, '$1'),
        port: urlParsed.port ? +urlParsed.port : (urlParsed.protocol === 'http:' ? 80 : 443),
        path: `${urlParsed.pathname}${urlParsed.search}`,
        method,
        headers,
        signal: options.signal
    }
    return { protocol: urlParsed.protocol, httpRequestOptions }
}

async function importHttpRequest(protocol: string) {
    const { request }= await (protocol === 'https:' ? import('https') : import('http'))
    return request
}
