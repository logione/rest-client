import { createServer, Server } from 'http'
import { Readable } from 'stream'

import { get, post } from '../fetch'
import { getJSON } from '../fetch-json'
import { getStream } from '../fetch-stream'
import { RequestError } from '../request-error'
import { RestClient } from '../index'

const ORIGIN = 'http://localhost:5006'

describe('retry specs', () => {
    let server: Server
    let attempts: Record<string, number>
    let nextId = 0

    beforeAll(async () => {
        // /<kind>/<value>/<failures>?id=…: fails <failures> times, then answers 200 with the number of attempts.
        server = createServer((req, res) => {
            const [path, query] = (req.url ?? '').split('?')
            const [, kind, value, failures] = path.split('/')
            const id = new URLSearchParams(query).get('id') ?? ''
            attempts[id] = (attempts[id] ?? 0) + 1
            req.resume()
            req.on('end', () => {
                if (attempts[id] > Number(failures)) {
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ attempts: attempts[id] }))
                } else if (kind === 'status') {
                    res.writeHead(Number(value)).end('failed')
                } else if (kind === 'retry-after') {
                    res.writeHead(503, { 'Retry-After': decodeURIComponent(value) }).end('busy')
                } else if (kind === 'drop') {
                    req.socket.destroy()
                }
            })
        })
        await new Promise<void>((resolve) => server.listen(5006, undefined, resolve))
    })

    afterAll(() => new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
    }))

    beforeEach(() => {
        attempts = {}
    })

    /** A URL of its own for each request, so that the server counts its attempts. */
    const url = (path: string) => {
        const id = String(nextId++)
        return { url: `${ORIGIN}${path}?id=${id}`, attempts: () => attempts[id] ?? 0 }
    }
    const status = (code: number) => jasmine.objectContaining({ status: code })

    it('should send the request again after a retried status', async () => {
        const target = url('/status/503/2')
        expect(await getJSON(target.url, { retry: { limit: 2, delay: 1 } })).toEqual({ attempts: 3 })
    })

    it('should throw the last error after the last retry', async () => {
        const target = url('/status/500/9')
        const error = (await getJSON(target.url, { retry: { limit: 1, delay: 1 } }).catch((err) => err)) as RequestError
        expect(error.status).toBe(500)
        expect(await error.response.text()).toBe('failed')
        expect(target.attempts()).toBe(2)
    })

    it('should not retry by default', async () => {
        const target = url('/status/503/1')
        await expectAsync(get(target.url)).toBeRejectedWith(status(503))
        expect(target.attempts()).toBe(1)
    })

    it('should accept the number of retries', async () => {
        const target = url('/status/502/1')
        expect(await getJSON(target.url, { retry: 1 })).toEqual({ attempts: 2 })
    })

    it('should not retry other statuses unless listed', async () => {
        const notFound = url('/status/404/1')
        await expectAsync(get(notFound.url, { retry: { limit: 2, delay: 1 } })).toBeRejectedWith(status(404))
        expect(notFound.attempts()).toBe(1)

        const listed = url('/status/404/1')
        expect(await getJSON(listed.url, { retry: { limit: 2, delay: 1, statusCodes: [404] } })).toEqual({ attempts: 2 })
    })

    it('should not retry POST unless listed in methods', async () => {
        const target = url('/status/503/1')
        await expectAsync(post(target.url, { body: 'data', retry: { limit: 2, delay: 1 } })).toBeRejectedWith(status(503))
        expect(target.attempts()).toBe(1)

        const listed = url('/status/503/1')
        const response = await post(listed.url, { body: 'data', retry: { limit: 2, delay: 1, methods: ['POST'] } })
        expect(await response.json()).toEqual({ attempts: 2 })
    })

    it('should retry a network error', async () => {
        const target = url('/drop/-/1')
        expect(await getJSON(target.url, { retry: { limit: 1, delay: 1 } })).toEqual({ attempts: 2 })
    })

    it('should wait for the Retry-After seconds', async () => {
        const target = url('/retry-after/0.2/1')
        const start = Date.now()
        expect(await getJSON(target.url, { retry: { limit: 1, delay: 1 } })).toEqual({ attempts: 2 })
        expect(Date.now() - start).toBeGreaterThanOrEqual(180)
    })

    it('should accept a Retry-After date', async () => {
        const target = url(`/retry-after/${encodeURIComponent(new Date(Date.now() - 1000).toUTCString())}/1`)
        expect(await getJSON(target.url, { retry: { limit: 1, delay: 1 } })).toEqual({ attempts: 2 })
    })

    it('should give up at once when Retry-After is longer than maxDelay', async () => {
        const target = url('/retry-after/120/1')
        const start = Date.now()
        await expectAsync(get(target.url, { retry: { limit: 2, maxDelay: 5000 } })).toBeRejectedWith(status(503))
        expect(Date.now() - start).toBeLessThan(1000)
        expect(target.attempts()).toBe(1)
    })

    it('should stop retrying when the timeout of the whole request expires', async () => {
        const target = url('/status/503/9')
        const start = Date.now()
        await expectAsync(get(target.url, { retry: { limit: 5, delay: 1000 }, timeout: 200 })).toBeRejectedWithError(DOMException, /timed out|aborted/i)
        expect(Date.now() - start).toBeLessThan(800)
        expect(target.attempts()).toBe(1)
    })

    it('should reject at once with the abort reason when aborted between attempts', async () => {
        const target = url('/status/503/9')
        const controller = new AbortController()
        setTimeout(() => controller.abort(new Error('stopped')), 50)
        const start = Date.now()
        await expectAsync(get(target.url, { retry: { limit: 5, delay: 1000 }, signal: controller.signal })).toBeRejectedWithError('stopped')
        expect(Date.now() - start).toBeLessThan(800)
    })

    it('should not retry a stream body', async () => {
        const target = url('/status/503/1')
        await expectAsync(post(target.url, { body: Readable.from(['data']), retry: { limit: 2, delay: 1, methods: ['POST'] } })).toBeRejectedWith(status(503))
        expect(target.attempts()).toBe(1)
    })

    it('should retry getStream', async () => {
        const target = url('/status/503/1')
        const response = await getStream(target.url, { retry: { limit: 1, delay: 1 } })
        let body = ''
        for await (const chunk of response) {
            body += chunk
        }
        expect(JSON.parse(body)).toEqual({ attempts: 2 })
    })

    it('should use the RestClient default, which a request can disable with 0', async () => {
        const api = new RestClient({ baseUrl: ORIGIN, retry: { limit: 1, delay: 1 } })
        const target = url('/status/503/1')
        expect(await api.getJSON(target.url.slice(ORIGIN.length))).toEqual({ attempts: 2 })

        const disabled = url('/status/503/1')
        await expectAsync(api.getJSON(disabled.url.slice(ORIGIN.length), { retry: 0 })).toBeRejectedWith(status(503))
        expect(disabled.attempts()).toBe(1)
    })
})
