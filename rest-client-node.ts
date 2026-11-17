import { getStream, patchStream, postStream, putStream, StreamResponse } from './fetch-stream.js'
import { IRestClient, RestClient as BrowserRestClient, RestClientRequestOptions } from './rest-client.js'

/** The methods of the Node.js RestClient, which adds the stream methods. */
export interface IRestStreamClient extends IRestClient {
    getStream(url: string, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse>
    postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse>
    putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse>
    patchStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse>
}

export class RestClient extends BrowserRestClient implements IRestStreamClient {
    getStream(url: string, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse> {
        return this.send(url, options, getStream)
    }

    postStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse> {
        return this.send(url, options, (target, merged) => postStream(target, readableStream, merged), false)
    }

    putStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse> {
        return this.send(url, options, (target, merged) => putStream(target, readableStream, merged), false)
    }

    patchStream(url: string, readableStream: NodeJS.ReadableStream, options?: RestClientRequestOptions<undefined>): Promise<StreamResponse> {
        return this.send(url, options, (target, merged) => patchStream(target, readableStream, merged), false)
    }
}
