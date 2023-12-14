## Smerf notes

### Handlers

```ts
// ./src/handlers/http/index.ts

import { createJSONResponse } from '@helloextend/api-utils'
import { createHttpHandler } from '@helloextend/smerf'

const handler = createHttpHandler((_req, _ctx) =>
  createJSONResponse('Hello Smerf'),
)

export const GET = handler
export const POST = createHttpHandler(async (req, _ctx) =>
  createJSONResponse(`Hello ${await req.text()}`),
)
```

`createHttpHandler` is a utility function to create an HTTP request handler. That function  takes a request and context object, and returns a response. It only exists to help you with the typing.

```ts
import type { Request } from 'node-fetch'
import type { Context } from '@helloextend/smerf'
const handler = async (req: Request, _ctx: Context) => {..})

// becomes 

const handler = createHttpHandler(async (req, _ctx) => {..})
```

`createJSONResponse` similarly helps with typing, as well as data serialization.

```ts
import type { Request } from 'node-fetch'
// ..
return new Response(JSON.stringify({ userAgent, text }), {status: 200})

// becomes
return createJSONResponse({userAgent, text}, 200)
```



```ts
/**
 * createJSONResponse - A utility function to create a JSON response.
 * @param {Object | string} data - The data to be sent in the response.
 * @param {number} statusCode - Optional HTTP status code, defaults to 200.
 * @returns {Object} An object representing the HTTP response.
 */
function createJSONResponse(data, statusCode?, headers? ) {
  let responseBody

  // Check if the data is already a string (e.g., a message), or an object that needs to be stringified
  if (typeof data === 'string') {
    responseBody = data
  } else {
    // Convert the object to a JSON string
    responseBody = JSON.stringify(data)
  }

  return {
    statusCode: statusCode,
    body: responseBody,
    headers: {
      'Content-Type': 'application/json',
    },
  }
}
```

#### Interacting with the headers

```ts
import { createJSONResponse } from '@helloextend/api-utils'
import { createHttpHandler } from '@helloextend/smerf'

const handler = createHttpHandler(async (req, _ctx) => {
  const userAgent = req.headers.get('User-Agent')
  const text = await req.text()

  return createJSONResponse(
    {
      userAgent,
      text,
    },
    201,
    {
      'Content-Type': 'application/json',
    },
  )
})

export const POST = handler
```

A test for the above:

```ts
// src/handlers/http/index.test.ts
import { POST } from './index'
import { makeTestContext, makeTestRequest } from '@helloextend/smerf'

describe('POST handler', () => {
  it('should return a JSON response', async () => {
    const response = await POST(
      // new Request('http:localhost:3000/', {
      //   method: 'POST',
      //   headers: { 'User-Agent': 'test' },
      //   body: 'Smerf Test',
      // }),
      makeTestRequest('http:localhost:3000/', {
        method: 'POST',
        headers: { 'User-Agent': 'test' },
        body: 'Smerf Test',
      }),
      // new Context(),
      makeTestContext(),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      userAgent: 'test',
      text: 'Smerf Test',
    })
  })
})
```

Smerf converts any uncaught exception to a 500 error.

```ts
// ./src/handlers/http/index.ts
const handler = createHttpHandler(async (req, _ctx) => {
  throw new Error('test error')
})
```

If we set the status code to 400/500, we can return an error with the customized status.

```ts
// ./src/handlers/http/index.ts
const handler = createHttpHandler(async (req, _ctx) => {
  return createJSONResponse('not found', 404)
})
```



### Middleware

Middleware functions are commonly used to process requests and responses, often performing tasks like: 

* logging
* authentication
* modifying requests/responses

They solve the challenge of attaching functionality before and after a request/response.

#### Middleware pattern

Middleware ordering: 

* On the way in to the handler : middleware get executed in order : 1, 2, 3
* On the way out of the handler: middleware get executed in reverse: 3, 2, 1

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/jfqayg3srnbv2w98ocpc.png)

#### Attaching middleware

>  `next`: A function, often referred to as the "next middleware function" in the stack. Calling `next()` within a middleware function will pass control to the next middleware function in line. If not called, the request-response cycle will halt in the current middleware.

```ts
// ./src/handlers/http/index.ts

import { createJSONResponse } from '@helloextend/api-utils'
import type { Context } from '@helloextend/smerf'
import smerf, { createHttpHandler } from '@helloextend/smerf'

const handler = createHttpHandler((_req, _ctx) =>
  createJSONResponse('Hello Smerf'),
)

export const POST = createHttpHandler(async (req, _ctx) =>
  createJSONResponse(`Hello ${await req.text()}`),
)

const middleware = async (
  _req: Request,
  _ctx: Context,
  next: () => Promise<Response>,
) => {
  // proceed with the next middleware or request handler, 
  // and give me the response they generate
  const response = await next() 
  // modify the response
  response.headers.set('x-powered-by', 'smerf')
  return response
}
// attach the middleware to the handler
export const GET = smerf.use(middleware).handler(handler)
```

#### Middleware ordering, Signature/helpers

`createHttpMiddleware` is a helper with types, similar to previous helpers.

```ts
// ./src/handlers/http/index.ts

import { createJSONResponse } from '@helloextend/api-utils'
import type { Context } from '@helloextend/smerf'
import smerf, {
  createHttpHandler,
  createHttpMiddleware,
} from '@helloextend/smerf'

const handler = createHttpHandler((_req, _ctx) => {
  console.log('HANDLER')
  return createJSONResponse('Hello Smerf')
})

const middlewareA = async (
  _req: Request,
  _ctx: Context,
  next: () => Promise<Response>,
) => {
  console.log('MIDDLEWARE A before')
  const response = await next()
  console.log('MIDDLEWARE A after')
  return response
}

const middlewareB = createHttpMiddleware(async (_req, _ctx, next) => {
  console.log('MIDDLEWARE B before')
  const response = await next()
  console.log('MIDDLEWARE B after')
  return response
})

// attach the middleware to the handler
export const GET = smerf.use([middlewareA, middlewareB]).handler(handler)
// same thing
// export const GET = smerf.use(middlewareA).use(middlewareB).handler(handler)

```

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7zygt7pkd2zf2lbi2hxy.png)

If we flip the order of the middleware, we can test the outcome. Here middlewareA is blocking, but both B and A enter the middleware, and B even executes on the way out, the header even gets added.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/myissh6nhnxrtf63dol2.png)

```ts
// ./src/handlers/http/index.ts

import { createJSONResponse } from '@helloextend/api-utils'
import smerf, {
  createHttpHandler,
  createHttpMiddleware,
} from '@helloextend/smerf'

const handler = createHttpHandler((_req, _ctx) => {
  console.log('HANDLER')
  return createJSONResponse('Hello Smerf')
})

const middlewareA = createHttpMiddleware(async (req, _ctx, next) => {
  console.log('MIDDLEWARE A before')
  if (req.headers.get('AUTHORIZATION') !== 'Bearer 123') {
    return createJSONResponse({ message: 'Unauthorized' }, 401)
  }
  const response = await next()
  console.log('MIDDLEWARE A after')
  return response
})

const middlewareB = createHttpMiddleware(async (_req, _ctx, next) => {
  console.log('MIDDLEWARE B before')
  const response = await next()
  console.log('MIDDLEWARE B after')
  response.headers.set('x-powered-by', 'smerf') // still gets executed
  return response
})

// attach the middleware to the handler
export const GET = smerf.use([middlewareB, middlewareA]).handler(handler)
```

Test with rest client extension:

```bash
# ./test.rest

@baseUrl = http://localhost:3000

GET {{baseUrl}}
```



#### Context API

Example of setting the context:



```ts
// ./src/handlers/http/index.ts

import { createJSONResponse } from '@helloextend/api-utils'
import smerf, {
  createHttpHandler,
  createHttpMiddleware,
} from '@helloextend/smerf'
import type { Context } from '@helloextend/smerf'

const getCtxKey = (ctx: Context, key: string) => ctx.get(key)

const handler = createHttpHandler(async (_req, ctx) => {
  console.log('HANDLER')
  // (2) retrieve the information from the context
  const userId = await getCtxKey(ctx, 'userId')
  return createJSONResponse(`Hello ${userId}`)
})

const authMiddleware = createHttpMiddleware(async (req, ctx, next) => {
  console.log('MIDDLEWARE A before')
  const authHeader = req.headers.get('AUTHORIZATION')

  if (authHeader?.startsWith('Bearer') !== true) {
    return createJSONResponse({ message: 'Unauthorized' }, 401)
  }
  // (1) set the context with the user information
  const userId = authHeader.split(' ')[1] // Bearer 123 -> 123
  ctx.set('userId', userId)

  const res = await next()
  res.headers.set('X-User-Id', userId)
  console.log('MIDDLEWARE A after')
  return res
})

const middlewareB = createHttpMiddleware(async (_req, _ctx, next) => {
  console.log('MIDDLEWARE B before')
  const res = await next()
  console.log('MIDDLEWARE B after')
  res.headers.set('X-Powered-By', 'smerf') // still gets executed
  return res
})

export const GET = smerf.use([middlewareB, authMiddleware]).handler(handler)
```

Test with rest client extension:

```bash
# ./test.rest

@baseUrl = http://localhost:3000

GET {{baseUrl}}
AUTHORIZATION: Bearer 123
```

Mind that we cannot set the same context multiple times. It will throw a 500 error. 
If we must do that, then use `allowOverride: true`

```ts

ctx.set('userId', userId)
ctx.set('userId', userId, {allowOverride: true})
```

#### Complex middleware

Let's say in case of error, we want to return a custom error, but we still want to set `X-Powered-By` headers. We create a new middleware `errorHandlerMiddleware`.

```ts
// ./src/handlers/http/index.ts
import { createJSONResponse } from '@helloextend/api-utils'
import smerf, {
  createHttpHandler,
  createHttpMiddleware,
} from '@helloextend/smerf'

const handler = createHttpHandler(async (_req, _ctx) => {
  console.log('HANDLER')
  throw new Error('Test')
})

const errorHandlerMiddleware = createHttpMiddleware(async (req, ctx, next) => {
  console.log('MIDDLEWARE B before')
  try {
    const res = await next()
    console.log('MIDDLEWARE B after')
    return res
  } catch (err: any) {
    console.log('MIDDLEWARE B error')
    return createJSONResponse({ message: 'some error' }, 409)
  }
})

const authMiddleware = createHttpMiddleware(async (req, ctx, next) => {
  console.log('MIDDLEWARE C before')
  const authHeader = req.headers.get('AUTHORIZATION')

  if (authHeader?.startsWith('Bearer') !== true) {
    return createJSONResponse({ message: 'Unauthorized' }, 401)
  }
  const userId = authHeader.split(' ')[1]
  ctx.set('userId', userId)

  const res = await next()
  res.headers.set('X-User-Id', userId)
  console.log('MIDDLEWARE C after')
  return res
})

const poweredByMiddleware = createHttpMiddleware(async (_req, _ctx, next) => {
  console.log('MIDDLEWARE A before')
  const res = await next()
  console.log('MIDDLEWARE A after')
  res.headers.set('X-Powered-By', 'smerf')
  return res
})

export const GET = smerf
  .use([poweredByMiddleware, errorHandlerMiddleware, authMiddleware])
  .handler(handler)

```

We get our custom message, status, and the header is still set by middleware A.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/hqi1kqxi45qy1r4z1eez.png)

```bash
HTTP/1.1 409 Conflict
content-type: application/json
x-powered-by: smerf
content-length: 24
Date: Thu, 14 Dec 2023 13:36:53 GMT
Connection: close

{
  "message": "some error"
}
```

#### Reusable middleware

Let's say we want our `poweredByMiddleware` to make `x-powered-by` "Smerf" or "Extend". We just use a function that returns a function (currying).

```ts
// ./src/handlers/http/index.ts

import { createJSONResponse } from '@helloextend/api-utils'
import type { Context } from '@helloextend/smerf'
import smerf, {
  createHttpHandler,
  createHttpMiddleware,
} from '@helloextend/smerf'

export const getCtxKey = (ctx: Context, key: string) => ctx.get(key)

const handler = createHttpHandler(async (_req, ctx) => {
  console.log('HANDLER')
  const userId = await getCtxKey(ctx, 'userId')
  return createJSONResponse(`Hello ${userId}`)
})

export const poweredByMiddleware = (poweredBy = 'Smerf') =>
  createHttpMiddleware(async (_req, _ctx, next) => {
    console.log('MIDDLEWARE A before')
    const res = await next()
    console.log('MIDDLEWARE A after')
    res.headers.set('X-Powered-By', poweredBy)
    return res
  })

export const errorHandlerMiddleware = createHttpMiddleware(
  async (req, ctx, next) => {
    console.log('MIDDLEWARE B before')
    try {
      const res = await next()
      console.log('MIDDLEWARE B after')
      return res
    } catch (err: unknown) {
      console.log('MIDDLEWARE B error')
      return createJSONResponse({ message: 'some error' }, 409)
    }
  },
)

export const authMiddleware = createHttpMiddleware(async (req, ctx, next) => {
  console.log('MIDDLEWARE C before')
  const authHeader = req.headers.get('AUTHORIZATION')

  if (authHeader?.startsWith('Bearer') !== true) {
    return createJSONResponse({ message: 'Unauthorized' }, 401)
  }
  const userId = authHeader.split(' ')[1]
  ctx.set('userId', userId)

  const res = await next()
  res.headers.set('X-User-Id', userId)
  console.log('MIDDLEWARE C after')
  userId //?
  return res
})

export const GET = smerf
  .use([poweredByMiddleware('extend'), errorHandlerMiddleware, authMiddleware])
  .handler(handler)

```

#### Testing

Define the request, context and next arguments.Feed them to the middleware and check the result.

If you want to test with handler, define the handler with middleware with `smerf.use(someMiddleware).handler(someHandler)` and invoke it with `(req, ctx`)

```ts
// ./src/handlers/http/index.test.ts

import { createJSONResponse } from '@helloextend/api-utils'
import {
  poweredByMiddleware,
  errorHandlerMiddleware,
  authMiddleware,
  getCtxKey,
} from './index'
import smerf, {
  makeTestContext,
  makeTestRequest,
  createHttpHandler,
} from '@helloextend/smerf'

test('test middleware by itself', async () => {
  const poweredBy = 'Smerf'
  const req = makeTestRequest()
  const ctx = makeTestContext()
  const next = () => Promise.resolve(new Response())
  const middleware = poweredByMiddleware(poweredBy)

  const res = await middleware(req, ctx, next)

  expect(res.headers.get('X-Powered-By')).toBe(poweredBy)
})

test('test middleware by combining it with a handler', async () => {
  const poweredBy = 'Smerf'
  const req = makeTestRequest()
  const ctx = makeTestContext()
  const someHandler = createHttpHandler(async (_req, _ctx) =>
    createJSONResponse('Hello World'),
  )
  const middleware = poweredByMiddleware(poweredBy)
  const handlerWithMiddleware = smerf.use(middleware).handler(someHandler)

  const res = await handlerWithMiddleware(req, ctx)

  expect(res.headers.get('X-Powered-By')).toBe(poweredBy)
})

test('errorHandlerMiddleware should catch errors and return error response', async () => {
  const req = makeTestRequest()
  const ctx = makeTestContext()
  const next = () => {
    throw new Error('Test error')
  }

  const res = await errorHandlerMiddleware(req, ctx, next)

  expect(res.status).toBe(409)
  // Read the Stream: Use res.text() to read the stream to completion.
  // This returns a promise that resolves with a text string representing the contents of the body.
  // Parse the Text: If the response body is JSON, you need to parse this text into a JavaScript object, using JSON.parse()
  const result = JSON.parse(await res.text())
  expect(result).toEqual({ message: 'some error' })
})

test('authMiddleware should return 401 if no valid auth header is present', async () => {
  const req = makeTestRequest() // Ensure this request does not have an AUTHORIZATION header
  const ctx = makeTestContext()

  const res = await authMiddleware(req, ctx, () =>
    Promise.resolve(new Response()),
  )
  expect(res.status).toBe(401)
  const result = JSON.parse(await res.text())
  expect(result).toEqual({ message: 'Unauthorized' })

  // handler testing (extra)
  // const someHandler = createHttpHandler(async (_req, _ctx) =>
  //   createJSONResponse('Hello World'),
  // )
  // const res2 = await smerf.use(authMiddleware).handler(someHandler)(req, ctx)
  // expect(res2.status).toBe(401)
})

test('authMiddleware should set userId in context for valid auth header', async () => {
  const userId = '12345'
  const req = makeTestRequest('http://localhost:3000', {
    headers: { AUTHORIZATION: `Bearer ${userId}` },
  })
  const ctx = makeTestContext()

  const next = () => Promise.resolve(new Response())
  const res = await authMiddleware(req, ctx, next)

  expect(res.status).toBe(200)
  const val = await getCtxKey(ctx, 'userId')
  expect(val).toEqual(userId)

  // handler version (extra)
  // const someHandler = createHttpHandler(async (_req, _ctx) =>
  //   createJSONResponse('Hello World'),
  // )
  // const res2 = await smerf.use(authMiddleware).handler(someHandler)(req, ctx)
  // expect(res2.status).toBe(200)
})
```



### Router

Like Next.js.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/i0h7oqlqqbjo4s8yf9zd.png)

### Local development





### Application from code

When the smerf build command runs, a `manifest.json` file is created, which powers cdk. 

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/cy4xbil3vzsrwoak9e4u.png)

