import { IncomingMessage } from 'http'

export class RequestError extends Error {
    constructor(message: string, public readonly status: number, public readonly headers: Headers, public readonly response: Response | IncomingMessage) {
        super(message)
    }
}
