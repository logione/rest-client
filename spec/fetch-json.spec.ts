import { createServer, IncomingMessage, Server } from 'http'

import { deleteJSON, getJSON, postJSON, putJSON } from '../fetch-json'
import { RequestError } from '../request-error'
import { StandardSchemaV1 } from '../standard-schema.v1'
import { SchemaValidationError } from '../schema-validation-error'

class TestStandardSchema implements StandardSchemaV1<{ value: string }, { value: number }> {
    '~standard': StandardSchemaV1.Props<{ value: string }, { value: number }> = {
        version: 1,
        vendor: 'test',
        validate: (data: unknown) => {
            if (typeof data !== 'object' || data === null || !('value' in data) || typeof data.value !== 'string') {
                return { issues: [{ message: 'Not formated correctly' }] }
            }
            const value = parseInt(data.value)
            if (isNaN(value)) {
                return { issues: [{ message: 'Value is not a number' }] }
            }
            return { value: { value } }
        }
    }
}

describe('fetch-json specs', () => {
    let server: Server
    let status: number
    let lastRequest: IncomingMessage | undefined
    let lastRequestBody: unknown
    let responseBody: string
    const schema = new TestStandardSchema() 

    beforeAll(async () => {
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
        await new Promise<void>((resolve) => {
            server.listen(5001, undefined, resolve)
        })
        await new Promise<void>((resolve) => setTimeout(resolve, 100))
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
            const result = await postJSON<{ fake: string }>(
                'http://localhost:5001/testpost', { 
                    body: { fake: 'Data' },
                    token: 'fakeToken',
                    headers: { 'custom-header': 'OK' },
                    search: { email: 'noreply@logi.one', pages: 1 } 
                }
            )
            expect(lastRequestBody).toEqual({ fake: 'Data'})
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testpost?email=noreply%40logi.one&pages=1')
            expect(lastRequest!.method).toBe('POST')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('application/json')
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBe('15')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await postJSON<{ fake: string }>('http://localhost:5001/testpost', { body: { fake: 'Data' }})
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })

        it('should validate schema if provided', async () => {
            status = 200
            responseBody = JSON.stringify({ value: '-250' })
            const result = await postJSON(
                'http://localhost:5001/testpost', { 
                    body: { fake: 'Data' },
                    schema
                }
            )
            expect(result).toEqual({ value: -250 })
        })

        it('should throw a SchemaValidationError if schema validation fails', async () => {
            status = 200
            responseBody = JSON.stringify({ value2: '-250' })
            let error
            try {
                await postJSON('http://localhost:5001/testpost', { 
                    body: { fake: 'Data' },
                    schema
                })
            } catch (err) {
                error = err
                expect(err instanceof SchemaValidationError).toBeTrue()
                expect((err as SchemaValidationError).message).toBe('Schema validation error')
                expect((err as SchemaValidationError).issues).toEqual([{ message: 'Not formated correctly' }])
            }
            expect(error).toBeDefined()
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

        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await postJSON<{ fake: string }>('http://localhost:5001/testpost', { body: { fake: 'Data' }})
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
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
            const result = await putJSON<{ fake: string }>(
                'http://localhost:5001/testput', {
                    body: { fake: 'Data' },
                    token: 'fakeToken',
                    headers: { 'custom-header': 'OK' },
                    search: 'page=1&page=2' 
            })
            expect(lastRequestBody).toEqual({ fake: 'Data'})
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testput?page=1&page=2')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('application/json')
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBe('15')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await putJSON<{ fake: string }>('http://localhost:5001/testput', { body: { fake: 'Data' }})
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })

        it('should validate schema if provided', async () => {
            status = 200
            responseBody = JSON.stringify({ value: '-250' })
            const result = await putJSON(
                'http://localhost:5001/testput', { 
                    body: { fake: 'Data' },
                    schema
                }
            )
            expect(result).toEqual({ value: -250 })
        })

        it('should throw a SchemaValidationError if schema validation fails', async () => {
            status = 200
            responseBody = JSON.stringify({ value2: '-250' })
            let error
            try {
                await putJSON('http://localhost:5001/testput', { 
                    body: { fake: 'Data' },
                    schema
                })
            } catch (err) {
                error = err
                expect(err instanceof SchemaValidationError).toBeTrue()
                expect((err as SchemaValidationError).message).toBe('Schema validation error')
                expect((err as SchemaValidationError).issues).toEqual([{ message: 'Not formated correctly' }])
            }
            expect(error).toBeDefined()
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
        
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await putJSON<{ fake: string }>('http://localhost:5001/testput', { body: { fake: 'Data' }})
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
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
            const result = await getJSON<{ fake: string }>(
                'http://localhost:5001/testget?limit=2', {
                    token: 'fakeToken',
                    headers: { 'custom-header': 'OK' },
                    search: [['type', 'email'], ['page', '1']]
                }
            )
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testget?limit=2&type=email&page=1')
            expect(lastRequest!.method).toBe('GET')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await getJSON<{ fake: string }>('http://localhost:5001/testget')
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })

        it('should validate schema if provided', async () => {
            status = 200
            responseBody = JSON.stringify({ value: '100' })
            const result = await getJSON(
                'http://localhost:5001/testget', { schema }
            )
            expect(result).toEqual({ value: 100 })
        })

        it('should throw a SchemaValidationError if schema validation fails', async () => {
            status = 200
            responseBody = JSON.stringify({ value: 'NotANumber' })
            let error
            try {
                await getJSON('http://localhost:5001/testget', { schema })
            } catch (err) {
                error = err
                expect(err instanceof SchemaValidationError).toBeTrue()
                expect((err as SchemaValidationError).message).toBe('Schema validation error')
                expect((err as SchemaValidationError).issues).toEqual([{ message: 'Value is not a number' }])
            }
            expect(error).toBeDefined()
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
                
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await getJSON<{ fake: string }>('http://localhost:5001/testget')
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
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

        it('should validate schema if provided', async () => {
            status = 200
            responseBody = JSON.stringify({ value: '100' })
            const result = await deleteJSON(
                'http://localhost:5001/testdelete', { schema }
            )
            expect(result).toEqual({ value: 100 })
        })

        it('should throw a SchemaValidationError if schema validation fails', async () => {
            status = 200
            responseBody = JSON.stringify({ value: 'NotANumber' })
            let error
            try {
                await deleteJSON('http://localhost:5001/testdelete', { schema })
            } catch (err) {
                error = err
                expect(err instanceof SchemaValidationError).toBeTrue()
                expect((err as SchemaValidationError).message).toBe('Schema validation error')
                expect((err as SchemaValidationError).issues).toEqual([{ message: 'Value is not a number' }])
            }
            expect(error).toBeDefined()
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
            
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await deleteJSON<{ fake: string }>('http://localhost:5001/testdelete')
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
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