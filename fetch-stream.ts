import { ClientRequest, IncomingMessage, RequestOptions as HTTPRequestOptions } from 'http'
import { pipeline } from 'stream/promises'

import { RequestError } from './request-error'
import { RequestOptions } from './request-options'

export async function getStream(url: string, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
    const { protocol, httpRequestOptions } = getHTTPRequestOptions('GET', url, options)
    const request = await importHttpRequest(protocol)
    return new Promise<IncomingMessage>((resolve, reject) => {
        const req = request(httpRequestOptions, (response) => {
            if (!response.statusCode) {
                reject(new Error('No status code'))
            } else if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new RequestError(response.statusMessage || '', response.statusCode))
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

export async function postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<void> {
    return postOrPutStream('POST', url, readableStream, options)
}

export async function putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<void> {
    return postOrPutStream('PUT', url, readableStream, options)
}

async function postOrPutStream(method: 'POST' | 'PUT', url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<void> {
    const { protocol, httpRequestOptions } = getHTTPRequestOptions(method, url, options)
    const request = await importHttpRequest(protocol)
    let req: ClientRequest | undefined
    const promise = new Promise<void>((resolve, reject) => {
        req = request(httpRequestOptions, (response) => {
            if (!response.statusCode) {
                reject(new Error('No status code'))
            } else if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new RequestError(response.statusMessage || '', response.statusCode))
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
