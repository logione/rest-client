export class RequestError<T = Response> extends Error {
    constructor(message: string, public readonly status: number, public readonly headers: Headers, public readonly response: T) {
        super(message)
        this.name = 'RequestError'
    }
}
