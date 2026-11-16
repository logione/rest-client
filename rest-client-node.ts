import { IncomingMessage } from 'http'

import { getStream, postStream, putStream } from './fetch-stream.js'
import { RequestOptions } from './request-options.js'
import { IRestClient, RestClient as BrowserRestClient } from './rest-client.js'

/** The methods of the Node.js RestClient, which adds the stream methods. */
export interface IRestStreamClient extends IRestClient {
    getStream(url: string, options?: RequestOptions<undefined>): Promise<IncomingMessage>
    postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<IncomingMessage>
    putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<IncomingMessage>
}

export class RestClient extends BrowserRestClient implements IRestStreamClient {
    getStream(url: string, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
        return getStream(this.resolveURL(url), this.withDefaults(options))
    }

    postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
        return postStream(this.resolveURL(url), readableStream, this.withDefaults(options))
    }

    putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RequestOptions<undefined>): Promise<IncomingMessage> {
        return putStream(this.resolveURL(url), readableStream, this.withDefaults(options))
    }
}
