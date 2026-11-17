import { IncomingMessage } from 'http'

import { getStream, patchStream, postStream, putStream } from './fetch-stream.js'
import { IRestClient, RestClient as BrowserRestClient, RestClientRequestOptions } from './rest-client.js'

/** The methods of the Node.js RestClient, which adds the stream methods. */
export interface IRestStreamClient extends IRestClient {
    getStream(url: string, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage>
    postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage>
    putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage>
    patchStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage>
}

export class RestClient extends BrowserRestClient implements IRestStreamClient {
    getStream(url: string, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage> {
        return getStream(...this.prepare(url, options))
    }

    postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage> {
        const [target, merged] = this.prepare(url, options)
        return postStream(target, readableStream, merged)
    }

    putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage> {
        const [target, merged] = this.prepare(url, options)
        return putStream(target, readableStream, merged)
    }

    patchStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<IncomingMessage> {
        const [target, merged] = this.prepare(url, options)
        return patchStream(target, readableStream, merged)
    }
}
