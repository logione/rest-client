import { appendSearchToURL } from '../search'

describe('search specs', () => {
    it('should append search to a URL without query', () => {
        expect(appendSearchToURL('http://x/p', { a: 1 })).toBe('http://x/p?a=1')
    })

    it('should append search to a URL with an existing query', () => {
        expect(appendSearchToURL('http://x/p?b=2', { a: 1 })).toBe('http://x/p?b=2&a=1')
        expect(appendSearchToURL('http://x/p?b=2&', { a: 1 })).toBe('http://x/p?b=2&a=1')
        expect(appendSearchToURL('http://x/p?', { a: 1 })).toBe('http://x/p?a=1')
    })

    it('should insert search before the fragment', () => {
        expect(appendSearchToURL('http://x/p#top', { a: 1 })).toBe('http://x/p?a=1#top')
        expect(appendSearchToURL('http://x/p?b=2#top', { a: 1 })).toBe('http://x/p?b=2&a=1#top')
        expect(appendSearchToURL('http://x/p#top?not=query', { a: 1 })).toBe('http://x/p?a=1#top?not=query')
    })

    it('should return the URL unchanged without search', () => {
        expect(appendSearchToURL('http://x/p#top')).toBe('http://x/p#top')
        expect(appendSearchToURL('http://x/p?b=2', {})).toBe('http://x/p?b=2')
    })
})
