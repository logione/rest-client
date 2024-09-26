import { Search } from './search'

export interface RequestOptions<T> {
    token?: string
    headers?: Record<string, string>
    body?: T | undefined
    search?: Search
}
