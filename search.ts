type SearchValue = string | number | boolean | null | undefined
export type Search = Record<string, SearchValue> | string | [string, string][] | URLSearchParams

export function appendSearchToURL(url: string, search?: Search): string {
    const query = convertSearchToURLSearchParams(search).toString()
    if (query === '') {
        return url
    }

    const hashIndex = url.indexOf('#')
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
    let base = hashIndex === -1 ? url : url.slice(0, hashIndex)

    if (base.includes('?')) {
        if (!base.endsWith('&') && !base.endsWith('?')) {
            base += '&'
        }
    } else {
        base += '?'
    }
    return base + query + hash
}

function convertSearchToURLSearchParams(query?: Search) {
    if (query instanceof URLSearchParams) {
        return query
    }

    if (typeof query !== 'object' || Array.isArray(query)) {
        return new URLSearchParams(query)
    }

    const urlSearchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
            urlSearchParams.append(key, String(value))
        }
    }
    return urlSearchParams
}