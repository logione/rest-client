import { createServer, IncomingMessage, Server } from 'http'

import { del, get, post, put } from '../fetch'

describe('fetch specs', () => {
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
                lastRequestBody = body
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
            responseBody = 'DataUpdated'
            const result = await post('http://localhost:5001/testpost', { body: 'Data', token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(lastRequestBody).toEqual('Data')
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testpost')
            expect(lastRequest!.method).toBe('POST')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('text/plain;charset=UTF-8')
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBe('4')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await post('http://localhost:5001/testpost', { body: 'Data' })
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await post('http://localhost:5001/testpost', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)

            status = 500
            try {
                await post('http://localhost:5001/testpost', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(500)
        })

        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await post('http://localhost:65012/testget', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('PUT', () => {
        it('should put data and parse json', async () => {
            status = 200
            responseBody = 'DataUpdated'
            const result = await put('http://localhost:5001/testput', { body: 'Data', token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(lastRequestBody).toEqual('Data')
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testput')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('text/plain;charset=UTF-8')
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBe('4')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await put('http://localhost:5001/testput', { body: 'Data' })
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await put('http://localhost:5001/testput', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })

        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await put('http://localhost:65012/testget', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('GET', () => {
        it('should get data and parse json', async () => {
            status = 200
            responseBody = 'DataUpdated'
            const result = await get('http://localhost:5001/testget', { token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testget')
            expect(lastRequest!.method).toBe('GET')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await get('http://localhost:5001/testget')
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await get('http://localhost:5001/testget')
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })
        
        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await get('http://localhost:65012/testget')
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('DELETE', () => {
        it('should delete data and parse json', async () => {
            status = 200
            responseBody = 'DataUpdated'
            const result = await del('http://localhost:5001/testdelete', { token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testdelete')
            expect(lastRequest!.method).toBe('DELETE')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await del('http://localhost:5001/testdelete')
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await del('http://localhost:5001/testdelete')
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })
        
        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await del('http://localhost:65012/testget')
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })
})