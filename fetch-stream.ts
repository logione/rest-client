import { IncomingHttpHeaders } from 'http'
import { Readable } from 'stream'
import { ReadableStream as WebReadableStream } from 'stream/web'

import { HttpMethod, request } from './fetch.js'
import { RequestError } from './request-error.js'
import { RequestOptions } from './request-options.js'

/**
 * The response of the stream functions: a Node.js Readable of the response body, with the status and
 * headers as in an http IncomingMessage.
 */
export interface StreamResponse extends Readable {
    statusCode: number
    statusMessage: string
    /** Lowercase header names, `set-cookie` as an array, other repeated headers joined with ", ". */
    headers: IncomingHttpHeaders
}

export async function getStream(url: string, options?: RequestOptions<undefined>): Promise<StreamResponse> {
    try {
        return toStreamResponse(await request('GET', url, options))
    } catch (err) {
        throw toStreamError(err)
    }
}

export async function postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<StreamResponse> {
    return uploadStream('POST', url, readableStream, options)
}

export async function putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<StreamResponse> {
    return uploadStream('PUT', url, readableStream, options)
}

export async function patchStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<StreamResponse> {
    return uploadStream('PATCH', url, readableStream, options)
}

async function uploadStream(method: HttpMethod, url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<StreamResponse> {
    const source = readableStream instanceof Readable ? readableStream : Readable.from(readableStream)
    let response: Response
    try {
        // A redirect can't be followed: the stream body can't be sent twice. The 3xx is thrown as is.
        response = await request(method, url, { ...options, body: source }, 'manual')
    } catch (err) {
        const error = source.errored ?? toStreamError(err)
        // The server refused the request or it failed: stop reading the rest of the source.
        source.destroy()
        throw error
    }
    // Not waiting for the source: a server can answer 2xx before reading the whole body, and waiting
    // for a source that doesn't end would never resolve. A source error after the answer is then lost.
    return toStreamResponse(response)
}

function toStreamResponse(response: Response): StreamResponse {
    const stream = response.body ? Readable.fromWeb(response.body as WebReadableStream<Uint8Array>) : Readable.from([])
    // Like an IncomingMessage, a response nobody reads must not crash the process with an unhandled
    // 'error' when its connection drops. Readers still get the error: for await and pipeline reject.
    stream.on('error', () => {})
    return Object.assign(stream, {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: toIncomingHeaders(response.headers)
    })
}

/**
 * Gives a RequestError a StreamResponse, and keeps the errors the stream functions threw before
 * they used fetch: the network error itself (ECONNREFUSED…) rather than fetch's "fetch failed".
 */
function toStreamError(err: unknown): unknown {
    if (err instanceof RequestError && err.response instanceof Response) {
        return new RequestError(err.message, err.status, err.headers, toStreamResponse(err.response))
    }
    if (err instanceof TypeError && err.message === 'fetch failed' && err.cause instanceof Error) {
        return err.cause
    }
    return err
}

function toIncomingHeaders(headers: Headers): IncomingHttpHeaders {
    const incoming: IncomingHttpHeaders = {}
    headers.forEach((value, name) => {
        if (name !== 'set-cookie') {
            incoming[name] = value
        }
    })
    const cookies = headers.getSetCookie()
    if (cookies.length > 0) {
        incoming['set-cookie'] = cookies
    }
    return incoming
}
