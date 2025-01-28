import { IncomingMessage } from 'http'

export class RequestError<T extends Response | IncomingMessage = Response> extends Error {
    constructor(message: string, public readonly status: number, public readonly headers: Headers, public readonly response: T) {
        super(message)
    }
}
