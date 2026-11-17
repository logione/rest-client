import { createServer, IncomingHttpHeaders, Server } from 'http'
import { Readable } from 'stream'

import { IRestClient, IRestStreamClient, RestClient } from '../index'
import { RequestError } from '../request-error'
import { StandardSchemaV1 } from '../standard-schema.v1'

const ORIGIN = 'http://localhost:5003'

interface Received {
    method: string
    url: string
    headers: IncomingHttpHeaders
    body: string
}

describe('RestClient specs', () => {
    let server: Server
    let received: Received[]

    beforeAll(async () => {
        server = createServer((req, res) => {
            let body = ''
            req.on('data', (data) => body += data)
            req.on('end', () => {
                received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body })
                if (req.url?.startsWith('/private') && req.headers.authorization !== 'Bearer fresh') {
                    // A slow 401 arrives after the renewal of a faster one has finished.
                    setTimeout(() => res.writeHead(401, 'Unauthorized').end('{"error":"expired"}'), req.url === '/private/slow' ? 300 : 0)
                } else if (req.url === '/missing') {
                    res.writeHead(404, 'Not Found').end()
                } else if (req.url === '/slow') {
                    setTimeout(() => res.end(), 1000)
                } else {
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ url: req.url, body: body || null }))
                }
            })
        })
        await new Promise<void>((resolve) => server.listen(5003, undefined, resolve))
    })

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    beforeEach(() => {
        received = []
    })

    const last = () => received[received.length - 1]

    describe('base URL', () => {
        const cases: [string, string, string][] = [
            [`${ORIGIN}/api`, 'items', '/api/items'],
            [`${ORIGIN}/api`, '/items', '/api/items'],
            [`${ORIGIN}/api/`, '/items', '/api/items'],
            [`${ORIGIN}/api/`, 'items?page=1', '/api/items?page=1'],
            [`${ORIGIN}/api`, '', '/api'],
            [`${ORIGIN}/api/`, '?page=1', '/api?page=1'],
            [ORIGIN, 'items', '/items'],
        ]
        for (const [baseUrl, url, expected] of cases) {
            it(`should join "${baseUrl}" and "${url}"`, async () => {
                await new RestClient({ baseUrl }).getJSON(url)
                expect(last().url).toBe(expected)
            })
        }

        it('should give the same URL with or without the slashes at the join', async () => {
            for (const baseUrl of [`${ORIGIN}/`, ORIGIN]) {
                for (const url of ['/url', 'url']) {
                    await new RestClient({ baseUrl }).get(url)
                }
            }
            expect(received.map((r) => r.url)).toEqual(['/url', '/url', '/url', '/url'])
        })

        it('should use absolute URLs as is', async () => {
            await new RestClient({ baseUrl: 'http://localhost:1/unused' }).getJSON(`${ORIGIN}/absolute`)
            expect(last().url).toBe('/absolute')
        })

        it('should treat a path with a colon as relative', async () => {
            await new RestClient({ baseUrl: `${ORIGIN}/v1` }).postJSON('documents:search')
            expect(last().url).toBe('/v1/documents:search')
        })

        it('should use a protocol-relative URL as is', async () => {
            const fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
            await new RestClient({ baseUrl: `${ORIGIN}/v1` }).getJSON('//cdn.example.com/file')
            expect(fetchSpy.calls.mostRecent().args[0]).toBe('//cdn.example.com/file')
        })

        it('should use the URL as is without a base URL', async () => {
            await new RestClient().getJSON(`${ORIGIN}/items`)
            expect(last().url).toBe('/items')
        })

        it('should append the search option after the base URL', async () => {
            await new RestClient({ baseUrl: ORIGIN }).getJSON('items', { search: { page: 2 } })
            expect(last().url).toBe('/items?page=2')
        })
    })

    describe('headers', () => {
        it('should send the default headers with every request', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, headers: { 'X-App': 'test' } })
            await client.getJSON('a')
            await client.postJSON('b', { body: { name: 'john' } })
            await client.get('c')
            expect(received.map((r) => r.headers['x-app'])).toEqual(['test', 'test', 'test'])
            expect(received[1].body).toBe('{"name":"john"}')
        })

        it('should accept a Headers instance or pairs as default headers', async () => {
            await new RestClient({ baseUrl: ORIGIN, headers: new Headers({ 'X-A': '1' }) }).getJSON('a')
            await new RestClient({ baseUrl: ORIGIN, headers: [['X-A', '2']] }).getJSON('a')
            expect(received.map((r) => r.headers['x-a'])).toEqual(['1', '2'])
        })

        it('should let request headers replace default headers ignoring case', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, headers: { 'X-App': 'default', 'X-Other': 'kept' } })
            await client.getJSON('a', { headers: { 'x-app': 'request' } })
            expect(last().headers['x-app']).toBe('request')
            expect(last().headers['x-other']).toBe('kept')
            expect(last().headers['accept']).toBe('application/json')
        })

        it('should set, get and remove default headers ignoring case', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, headers: { 'X-App': 'one' } })
            client.setHeader('x-app', 'two')
            expect(client.getHeader('X-APP')).toBe('two')
            await client.getJSON('a')
            expect(last().headers['x-app']).toBe('two')

            client.removeHeader('X-App')
            expect(client.getHeader('x-app')).toBeUndefined()
            await client.getJSON('a')
            expect(last().headers['x-app']).toBeUndefined()
        })

        it('should not change the default headers nor the request options when sending', async () => {
            const defaults = { 'X-App': 'default' }
            const client = new RestClient({ baseUrl: ORIGIN, headers: defaults })
            const options = { headers: { 'X-Req': 'request' } }
            await client.getJSON('a', options)
            defaults['X-App'] = 'changed'
            await client.getJSON('a')
            expect(last().headers['x-app']).toBe('default')
            expect(last().headers['x-req']).toBeUndefined()
            expect(options).toEqual({ headers: { 'X-Req': 'request' } })
        })
    })

    describe('token', () => {
        it('should send the default token', async () => {
            await new RestClient({ baseUrl: ORIGIN, token: 'default' }).getJSON('a')
            expect(last().headers.authorization).toBe('Bearer default')
        })

        it('should use a token changed after construction', async () => {
            const client = new RestClient({ baseUrl: ORIGIN })
            await client.getJSON('a')
            expect(last().headers.authorization).toBeUndefined()
            client.token = 'later'
            await client.getJSON('a')
            expect(last().headers.authorization).toBe('Bearer later')
            client.token = undefined
            await client.getJSON('a')
            expect(last().headers.authorization).toBeUndefined()
        })

        it('should prefer the request token or Authorization header', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, token: 'default' })
            await client.getJSON('a', { token: 'request' })
            expect(last().headers.authorization).toBe('Bearer request')
            await client.getJSON('a', { headers: { authorization: 'Basic abc' } })
            expect(last().headers.authorization).toBe('Basic abc')
        })
    })

    describe('ignoreDefaults', () => {
        const client = () => new RestClient({ baseUrl: `${ORIGIN}/v1`, token: 'secret', headers: { 'X-App': 'test' }, timeout: 20 })

        it('should send the request without any default', async () => {
            await client().getJSON(`${ORIGIN}/presigned`, { ignoreDefaults: true })
            await client().get(`${ORIGIN}/slow`, { ignoreDefaults: true })
            const stream = await client().getStream(`${ORIGIN}/presigned`, { ignoreDefaults: true })
            stream.resume()
            expect(received.map((r) => `${r.url} ${r.headers.authorization} ${r.headers['x-app']}`)).toEqual([
                '/presigned undefined undefined', '/slow undefined undefined', '/presigned undefined undefined'
            ])
        })

        it('should still send the request own options', async () => {
            await client().getJSON(`${ORIGIN}/own`, { ignoreDefaults: true, token: 'own', headers: { 'X-Own': 'yes' }, search: { a: 1 } })
            expect(last().url).toBe('/own?a=1')
            expect(last().headers.authorization).toBe('Bearer own')
            expect(last().headers['x-own']).toBe('yes')
        })

        it('should not use the base URL', async () => {
            const fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async () => new Response(''))
            await client().get('relative', { ignoreDefaults: true })
            expect(fetchSpy.calls.mostRecent().args[0]).toBe('relative')
            expect('ignoreDefaults' in fetchSpy.calls.mostRecent().args[1]!).toBeFalse()
        })

        it('should keep the schema validation', async () => {
            const schema: StandardSchemaV1<unknown, string> = {
                '~standard': { version: 1, vendor: 'test', validate: (value: any) => ({ value: value.url }) }
            }
            const url: string = await client().getJSON(`${ORIGIN}/items`, { ignoreDefaults: true, schema })
            expect(url).toBe('/items')
        })
    })

    describe('timeout and credentials', () => {
        it('should apply the default timeout and let a request override it', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, timeout: 20 })
            await expectAsync(client.get('slow')).toBeRejectedWith(jasmine.objectContaining({ name: 'TimeoutError' }))
            client.timeout = undefined
            await expectAsync(client.get('slow', { timeout: 20 })).toBeRejectedWith(jasmine.objectContaining({ name: 'TimeoutError' }))
        })

        it('should let a request remove the default timeout with null or Infinity', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, timeout: 20 })
            await expectAsync(client.get('slow', { timeout: null })).toBeResolved()
            await expectAsync(client.get('slow', { timeout: Infinity })).toBeResolved()
        })

        it('should keep the request signal along with the default timeout', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, timeout: 5000 })
            const controller = new AbortController()
            const promise = client.get('slow', { signal: controller.signal })
            controller.abort()
            await expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ name: 'AbortError' }))
        })

        it('should pass the default credentials and let a request override them', async () => {
            const fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
            const client = new RestClient({ baseUrl: ORIGIN, credentials: 'include' })
            await client.getJSON('a')
            await client.getJSON('a', { credentials: 'omit' })
            client.credentials = undefined
            await client.getJSON('a')
            expect(fetchSpy.calls.allArgs().map(([, init]) => init?.credentials)).toEqual(['include', 'omit', undefined])
        })
    })

    describe('methods', () => {
        it('should send every JSON and raw method to the resolved URL', async () => {
            const client = new RestClient({ baseUrl: ORIGIN })
            await client.getJSON('a')
            await client.postJSON('b', { body: 1 })
            await client.putJSON('c', { body: 2 })
            await client.deleteJSON('d')
            await client.get('e')
            await client.post('f', { body: 'text' })
            await client.put('g', { body: 'text' })
            await client.del('h')
            await client.patchJSON('i', { body: 3 })
            await client.patch('j', { body: 'text' })
            await client.head('k')
            expect(received.map((r) => `${r.method} ${r.url}`)).toEqual([
                'GET /a', 'POST /b', 'PUT /c', 'DELETE /d', 'GET /e', 'POST /f', 'PUT /g', 'DELETE /h', 'PATCH /i', 'PATCH /j', 'HEAD /k'
            ])
        })

        it('should validate the response with a schema', async () => {
            const schema: StandardSchemaV1<unknown, string> = {
                '~standard': { version: 1, vendor: 'test', validate: (value: any) => ({ value: value.url }) }
            }
            const url: string = await new RestClient({ baseUrl: ORIGIN }).getJSON('items', { schema })
            expect(url).toBe('/items')
        })

        it('should throw a RequestError', async () => {
            await expectAsync(new RestClient({ baseUrl: ORIGIN }).getJSON('missing')).toBeRejectedWithError(RequestError, 'Not Found')
        })

        it('should get, post, put and patch streams with the defaults', async () => {
            const client = new RestClient({ baseUrl: ORIGIN, token: 'stream', headers: { 'X-App': 'test' } })
            const response = await client.getStream('s1')
            response.resume()
            const upload = await client.postStream('s2', Readable.from(['abc']))
            upload.resume()
            const replace = await client.putStream('s3', Readable.from(['def']))
            replace.resume()
            const update = await client.patchStream('s4', Readable.from(['ghi']))
            update.resume()
            expect(received.map((r) => `${r.method} ${r.url} ${r.body} ${r.headers.authorization} ${r.headers['x-app']}`)).toEqual([
                'GET /s1  Bearer stream test', 'POST /s2 abc Bearer stream test', 'PUT /s3 def Bearer stream test', 'PATCH /s4 ghi Bearer stream test'
            ])
        })
    })

    describe('onUnauthorized', () => {
        const methods = () => received.map((r) => `${r.method} ${r.url} ${r.headers.authorization}`)
        const status401 = jasmine.objectContaining({ status: 401 })
        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

        it('should set the returned token and send the request again once', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.callFake((error: RequestError<unknown>) => {
                expect(error.status).toBe(401)
                return 'fresh'
            })
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            expect(await api.postJSON('private', { body: { a: 1 } })).toEqual({ url: '/private', body: '{"a":1}' })
            expect(api.token).toBe('fresh')
            expect(onUnauthorized).toHaveBeenCalledTimes(1)
            expect(methods()).toEqual(['POST /private Bearer old', 'POST /private Bearer fresh'])
            expect(received[1].body).toBe('{"a":1}')

            await api.getJSON('private')
            expect(methods()[2]).toBe('GET /private Bearer fresh')
            expect(onUnauthorized).toHaveBeenCalledTimes(1)
        })

        it('should give up like false when onUnauthorized returns true or an empty string', async () => {
            for (const result of [true, '']) {
                const onUnauthorized = jasmine.createSpy('onUnauthorized').and.returnValue(result)
                const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
                const error: RequestError = await api.get('private').catch((err) => err)
                expect(error.status).withContext(String(result)).toBe(401)
                expect(await error.response.json()).withContext(String(result)).toEqual({ error: 'expired' })
                await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
                expect(onUnauthorized).withContext(String(result)).toHaveBeenCalledTimes(1)
                expect(api.token).toBe('old')
            }
            expect(received.length).toBe(4)
        })

        it('should not be called for a client whose token is empty', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.returnValue('fresh')
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            api.token = '' // e.g. after a logout
            await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
            expect(onUnauthorized).not.toHaveBeenCalled()
            expect(methods()).toEqual(['GET /private undefined'])
        })

        it('should not be called for a client without token, with only a default Authorization header', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.returnValue('fresh')
            const api = new RestClient({ baseUrl: ORIGIN, headers: { Authorization: 'Bearer old' }, onUnauthorized })
            await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
            expect(onUnauthorized).not.toHaveBeenCalled()
            expect(received.length).toBe(1)
        })

        it('should not apply the changes made on the client given to onUnauthorized', async () => {
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', headers: { 'X-App': 'test' }, onUnauthorized: (_, client) => {
                client.token = 'ignored'
                client.setHeader('X-Renewed', 'yes')
                client.removeHeader('X-App')
                return 'fresh'
            } })
            await api.getJSON('private')
            expect(api.token).toBe('fresh')
            expect(api.getHeader('X-Renewed')).toBeUndefined()
            expect(api.getHeader('X-App')).toBe('test')
            expect(last().headers['x-renewed']).toBeUndefined()
            expect(last().headers['x-app']).toBe('test')
        })

        describe('a 401 that arrives after the renewal', () => {
            it('should send again without renewing a token twice', async () => {
                const onUnauthorized = jasmine.createSpy('onUnauthorized').and.resolveTo('fresh')
                const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
                await Promise.all([api.getJSON('private'), api.getJSON('private/slow')])
                expect(onUnauthorized).toHaveBeenCalledTimes(1)
            })

            it('should not call onUnauthorized again for a token it failed to renew', async () => {
                const onUnauthorized = jasmine.createSpy('onUnauthorized').and.returnValue(false)
                const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
                const results = await Promise.allSettled([api.getJSON('private'), api.getJSON('private/slow')])
                expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
                expect(onUnauthorized).toHaveBeenCalledTimes(1)
            })
        })

        it('should throw the 401 with its body when onUnauthorized returns false or is not set', async () => {
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized: async () => false as const })
            const error: RequestError = await api.get('private').catch((err) => err)
            expect(error.status).toBe(401)
            expect(await error.response.json()).toEqual({ error: 'expired' })
            api.onUnauthorized = undefined
            api.token = 'other'
            await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
            expect(received.length).toBe(2)
        })

        it('should not call onUnauthorized again for a token it failed to renew', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.returnValue(false)
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
            await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
            expect(onUnauthorized).toHaveBeenCalledTimes(1)

            api.token = 'other' // e.g. after a new login
            await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
            expect(onUnauthorized).toHaveBeenCalledTimes(2)
        })

        it('should send the request again only once', async () => {
            // The server only accepts "fresh": the retry gets a 401 too.
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.resolveTo('still-invalid')
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            await expectAsync(api.getJSON('private')).toBeRejectedWith(status401)
            expect(onUnauthorized).toHaveBeenCalledTimes(1)
            expect(received.length).toBe(2)
        })

        it('should share one call between requests that get a 401 at the same time', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.callFake(async () => {
                await delay(50)
                return 'fresh'
            })
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            const results = await Promise.all([api.getJSON('private1'), api.getJSON('private2'), api.get('private3')])
            expect(results.length).toBe(3)
            expect(onUnauthorized).toHaveBeenCalledTimes(1)
        })

        it('should make a request started during the renewal wait for it', async () => {
            let renewing!: () => void
            const started = new Promise<void>((resolve) => renewing = resolve)
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.callFake(async () => {
                renewing()
                await delay(200)
                return 'fresh'
            })
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            const first = api.getJSON('private/a')
            await started
            const second = api.getJSON('private/b')
            await expectAsync(Promise.all([first, second])).toBeResolved()
            expect(onUnauthorized).toHaveBeenCalledTimes(1)
        })

        it('should send again without calling onUnauthorized when the token changed meanwhile', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized')
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            const pending = api.getJSON('private')
            api.token = 'fresh'
            await pending
            expect(onUnauthorized).not.toHaveBeenCalled()
            expect(methods()).toEqual(['GET /private Bearer old', 'GET /private Bearer fresh'])
        })

        it('should give onUnauthorized a copy of the defaults whose 401s reject at once', async () => {
            const api = new RestClient({
                baseUrl: ORIGIN,
                token: 'old',
                headers: { 'X-App': 'test' },
                onUnauthorized: async (_, client) => {
                    expect(client).not.toBe(api)
                    expect(client.onUnauthorized).toBeUndefined()
                    await expectAsync(client.postJSON('private/refresh')).toBeRejectedWith(status401)
                    return 'fresh'
                }
            })
            await api.getJSON('private')
            expect(methods()).toEqual(['GET /private Bearer old', 'POST /private/refresh Bearer old', 'GET /private Bearer fresh'])
            expect(received[1].headers['x-app']).toBe('test')
        })

        it('should refresh the token as in the README', async () => {
            let refreshToken = 'r1'
            const api = new RestClient({
                baseUrl: ORIGIN,
                token: 'old',
                onUnauthorized: async (_, client) => {
                    const tokens = await client.postJSON<{ body: string }>('auth/token', { body: { refresh_token: refreshToken }, token: '' })
                    expect(tokens.body).toBe('{"refresh_token":"r1"}')
                    refreshToken = 'r2'
                    return 'fresh'
                }
            })
            await api.getJSON('private')
            expect(methods()).toEqual(['GET /private Bearer old', 'POST /auth/token undefined', 'GET /private Bearer fresh'])
            expect(refreshToken).toBe('r2')
        })

        it('should throw the onUnauthorized error and call it again on the next 401', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.throwError('refresh failed')
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            await expectAsync(api.getJSON('private')).toBeRejectedWithError('refresh failed')
            await expectAsync(api.getJSON('private')).toBeRejectedWithError('refresh failed')
            expect(onUnauthorized).toHaveBeenCalledTimes(2)
        })

        it('should not be called for a request with its own credentials or without defaults', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.returnValue('fresh')
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            await expectAsync(api.getJSON('private', { token: 'mine' })).toBeRejectedWith(status401)
            await expectAsync(api.getJSON('private', { headers: { authorization: 'Basic x' } })).toBeRejectedWith(status401)
            await expectAsync(api.getJSON(`${ORIGIN}/private`, { ignoreDefaults: true })).toBeRejectedWith(status401)
            expect(onUnauthorized).not.toHaveBeenCalled()
        })

        it('should not send a stream body twice', async () => {
            const onUnauthorized = jasmine.createSpy('onUnauthorized').and.returnValue('fresh')
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized })
            await expectAsync(api.post('private', { body: Readable.from(['abc']) })).toBeRejectedWith(status401)
            await expectAsync(api.putStream('private', Readable.from(['abc']))).toBeRejectedWith(status401)
            expect(onUnauthorized).not.toHaveBeenCalled()
            expect(received.length).toBe(2)
        })

        it('should get a stream again with the renewed token', async () => {
            const api = new RestClient({ baseUrl: ORIGIN, token: 'old', onUnauthorized: () => 'fresh' })
            const response = await api.getStream('private')
            response.resume()
            expect(response.statusCode).toBe(200)
            expect(methods()).toEqual(['GET /private Bearer old', 'GET /private Bearer fresh'])
        })
    })

    describe('mocking', () => {
        class UserService {
            constructor(private readonly api: IRestClient) {}
            getName(id: number) {
                return this.api.getJSON<{ name: string }>(`users/${id}`).then((user) => user.name)
            }
        }

        it('should be mockable with spyOn on an instance', async () => {
            const api = new RestClient()
            const spy = spyOn(api, 'getJSON').and.resolveTo({ name: 'Ada' })
            expect(await new UserService(api).getName(1)).toBe('Ada')
            expect(spy).toHaveBeenCalledWith('users/1')
            expect(received).toEqual([])
        })

        it('should be mockable with a spy object typed by the interface', async () => {
            const api = jasmine.createSpyObj<IRestStreamClient>('api', ['getJSON'])
            api.getJSON.and.resolveTo({ name: 'Grace' })
            expect(await new UserService(api).getName(2)).toBe('Grace')
        })
    })
})
