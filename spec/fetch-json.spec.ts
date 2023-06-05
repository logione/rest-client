import { createServer, IncomingMessage, Server } from 'http'

import { deleteJSON, getJSON, postJSON, putJSON } from '../fetch-json'

describe('fetch-json specs', () => {
    let server: Server
    let status: number
    let lastRequest: IncomingMessage | undefined
    let lastRequestBody: unknown
    let responseBody: string

    beforeAll(() => {
        server = createServer(async (req, res) => {
            lastRequest = req
            let body = ''
            req.on('data', (data) => {
                body += data
            })
            req.on('end', () => {
                if (typeof body === 'string') {
                    try {
                        lastRequestBody = JSON.parse(body)
                    } catch (err) {
                        lastRequestBody = body
                    }
                }
                if (typeof responseBody === 'string' && responseBody) {
                    try {
                        JSON.parse(responseBody)
                        res.setHeader('Content-Type', 'application/json; charset=utf-8')
                    } catch (err) {
                    }
                }
                res.writeHead(status)
                if (responseBody) {
                    res.write(responseBody)
                    res.end()
                } else {
                    res.end()
                }
            })
        })
        server.listen(5001)
    })

    beforeEach(() => {
        status = 204
        responseBody = ''
        lastRequestBody = undefined
    })

    afterAll(() => {
        return new Promise<void>((resolve) => {
            server.close(() => { resolve() })
        })
    })

    describe('POST', () => {
        it('should post data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await postJSON<{ fake: string }>('http://localhost:5001/testpost', { body: { fake: 'Data' }, token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(lastRequestBody).toEqual({ fake: 'Data'})
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testpost')
            expect(lastRequest!.method).toBe('POST')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('application/json')
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBe('15')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await postJSON<{ fake: string }>('http://localhost:5001/testpost', { body: { fake: 'Data' }})
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await postJSON<{ fake: string }>('http://localhost:5001/testpost', { body: { fake: 'Data' }})
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)

            status = 500
            try {
                await postJSON<{ fake: string }>('http://localhost:5001/testpost', { body: { fake: 'Data' }})
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(500)
        })
            
        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await postJSON<{ fake: string }>('http://localhost:65012/testpost', { body: { fake: 'Data' }})
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('PUT', () => {
        it('should put data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await putJSON<{ fake: string }>('http://localhost:5001/testput', { body: { fake: 'Data' }, token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(lastRequestBody).toEqual({ fake: 'Data'})
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testput')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('application/json')
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBe('15')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await putJSON<{ fake: string }>('http://localhost:5001/testput', { body: { fake: 'Data' }})
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await putJSON<{ fake: string }>('http://localhost:5001/testput', { body: { fake: 'Data' }})
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })

        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await putJSON<{ fake: string }>('http://localhost:65012/testpost', { body: { fake: 'Data' }})
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('GET', () => {
        it('should get data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await getJSON<{ fake: string }>('http://localhost:5001/testget', { token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testget')
            expect(lastRequest!.method).toBe('GET')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await getJSON<{ fake: string }>('http://localhost:5001/testget')
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await getJSON<{ fake: string }>('http://localhost:5001/testget')
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })

        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await getJSON<{ fake: string }>('http://localhost:65012/testget')
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('DELETE', () => {
        it('should delete data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await deleteJSON<{ fake: string }>('http://localhost:5001/testdelete', { token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testdelete')
            expect(lastRequest!.method).toBe('DELETE')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await deleteJSON<{ fake: string }>('http://localhost:5001/testdelete')
            expect(lastRequest!.headers.authorization).toBeUndefined()

            responseBody = 'OK'
            const result2 = await deleteJSON<string>('http://localhost:5001/testdelete', { token: 'fakeToken' })
            expect(result2).toEqual('OK')
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await deleteJSON<{ fake: string }>('http://localhost:5001/testdelete')
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })

        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await deleteJSON<{ fake: string }>('http://localhost:65012/testget')
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })
})