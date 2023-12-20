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

> Compared to middy, the API is more pleasant
>
> ```ts
> middy(handler).use(middlewareA).use(middlewareB)
> ```

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7zygt7pkd2zf2lbi2hxy.png)

If we flip the order of the middleware, we can test the outcome. Here middlewareA is blocking, but both B and A enter the middleware, and B even executes on the way out, the header even gets added.

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

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/myissh6nhnxrtf63dol2.png)

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

#### Extend Default Middleware

`extendDefaultMiddleware` is our boilerplate - it is core middleware that we want to apply to every API endpoint. This includes:

- Logger
- Error handler
- Extend testing

You can optionally add:

- CORS
- Auth
- Version mapping

TODO: fix the type issue

```ts
// ./src/handlers/http/index.ts
import {
  createJSONResponse,
  extendDefaultMiddleware,
} from '@helloextend/api-utils'
import smerf, { createHttpHandler } from '@helloextend/smerf'

const handler = createHttpHandler(async (_req, ctx) => {
  // with extendDefaultMiddleware, we can grab the logger from the context
  const logger = await getLogger(ctx) 
  logger.info('here is some info')
  return createJSONResponse({ data: 'Hello Extend' })
})

const handlerWithMiddleware = smerf
  .use([extendDefaultMiddleware()])
  .handler(handler)

export const GET = handlerWithMiddleware
```

```ts
// ./src/handlers/http/index.test.ts

import { GET } from './index'
import { makeTestContext, makeTestRequest } from '@helloextend/smerf'

describe('GET handler', () => {
  it('should return a JSON response', async () => {
    const req = makeTestRequest()
    const ctx = makeTestContext()

    // Error: KeyNotFound req.pathParams not found in context. 
    // Did you forget to set it or attach the middleware?
    const response = await GET(req, ctx)

    expect(response.status).toBe(200)
    expect(await response.json()).toBe('Hello Smerf')
  })
})
```

#### Versioning middleware

`versionIOMapperMiddleware` allows us to give different responses for different versions, while not having more than one handler.

```ts
// ./src/handlers/http/index.ts

import {
  ApiVersion,
  createJSONResponse,
  extendDefaultMiddleware,
  versionIOMapperMiddleware,
} from '@helloextend/api-utils'
import smerf, {
  createHttpHandler,
  createHttpMiddleware,
  getLogger,
} from '@helloextend/smerf'

const handler = createHttpHandler(async (_req, ctx) => {
  // with extendDefaultMiddleware, we can grab the logger from the context
  const logger = await getLogger(ctx)
  logger.info('here is some info')
  return createJSONResponse({ data: 'Hello Extend' })
})

export const poweredByMiddleware = (poweredBy = 'Smerf') =>
  createHttpMiddleware(async (_req, _ctx, next) => {
    console.log('MIDDLEWARE A before')
    const res = await next()
    console.log('MIDDLEWARE A after')
    res.headers.set('X-Powered-By', poweredBy)
    return res
  })

const handlerWithMiddleware = smerf
  .use(poweredByMiddleware(),extendDefaultMiddleware())
  .use(
    versionIOMapperMiddleware([
      {
        version: '1',
        aliases: [
          'default',
          ApiVersion['2019-08-01'],
          ApiVersion['2020-08-01'],
        ],
        response: {
          mapper: output => {
            // KEY (this could even be a promise)
            return Promise.resolve({
              ...output,
              data: 'Hello Smerf',
            })
          },
          // mapper: output => {
          //   return {
          //     ...output,
          //     data: 'Hello Smerf',
          //   }
          // },
        },
      },
      {
        version: '2',
        aliases: [
          'latest',
          'dev',
          ApiVersion['2021-01-01'],
          ApiVersion['2021-04-01'],
        ],
      },
    ]),
  )
  .handler(handler)

export const GET = handlerWithMiddleware
```

```bash
@baseUrl = http://localhost:3000


###  

GET {{baseUrl}}
x-extend-api-version: default

###

GET {{baseUrl}}
x-extend-api-version: latest
```

`default` gives the mapped `Hello Smerf`

```bash
HTTP/1.1 200 OK
content-type: application/json
x-powered-by: Smerf
content-length: 22
Date: Mon, 18 Dec 2023 18:49:16 GMT
Connection: close

{
  "data": "Hello Smerf"
}
```

While `latest` gives `Hello Extend`

```bash
HTTP/1.1 200 OK
content-type: application/json
x-powered-by: Smerf
content-length: 23
Date: Mon, 18 Dec 2023 18:50:48 GMT
Connection: close

{
  "data": "Hello Extend"
}
```

### Router

Like Next.js.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/i0h7oqlqqbjo4s8yf9zd.png)

```ts
// ./src/handlers/http/hello/[name].ts

import { createJSONResponse } from '@helloextend/api-utils'
import { createHttpHandler, getUrlParams } from '@helloextend/smerf'

const handler = createHttpHandler(async (_req, ctx) => {
  const { name } = await getUrlParams(ctx)
  return createJSONResponse(`Hello ${name}`)
})

export const GET = handler
```

```bash
# test.rest

@baseUrl = http://localhost:3000

GET {{baseUrl}}/hello/murat
```

```bash
HTTP/1.1 200 OK
content-type: application/json
content-length: 13
Date: Tue, 19 Dec 2023 14:18:28 GMT
Connection: close

"Hello murat"
```

When we use `start:smerf` , `smerf build ` executes and creates a a file `.smerf/manifest.json`.

An entry is created for every endpoint in the application.

In turn, local server imports this file  and starts up the routes (using Fastify under the hood).

```json
{
    "handlers": {
        "http": [
            {
                "filePath": "handlers/http/hello/[name].GET.ts",
                "export": "default",
                "httpMethod": "GET",
                "urlPath": "/hello/[name]",
                "originalFilePath": "../src/handlers/http/hello/[name].ts",
                "originalExport": "GET",
                "config": {}
            },
            {
                "filePath": "handlers/http/index.GET.ts",
                "export": "default",
                "httpMethod": "GET",
                "urlPath": "/",
                "originalFilePath": "../src/handlers/http/index.ts",
                "originalExport": "GET",
                "config": {}
            }
        ],
        "events": [
            {
                "filePath": "handlers/events/example.ts",
                "export": "default",
                "topic": "/example",
                "originalFilePath": "../src/handlers/events/example.ts",
                "originalExport": "default",
                "config": {}
            }
        ]
    },
    "adapters": {}
}
```

#### Middleware options

Let's say we have a situation where we are repeating the middleware.

```ts
// ./src/handlers/http/world.ts

import { createJSONResponse } from '@helloextend/api-utils'
import smerf, {
  createHttpHandler,
  createHttpMiddleware,
} from '@helloextend/smerf'

const handlerGET = createHttpHandler(async (_req, _ctx) => {
  return createJSONResponse({ data: 'GET World' })
})

const handlerPOST = createHttpHandler(async (_req, _ctx) => {
  return createJSONResponse({ data: 'POST World' })
})

const middleware = createHttpMiddleware(async (_req, _ctx, next) => {
  const res = await next()
  res.headers.set('X-Powered-By', 'Extend')
  return res
})

export const GET = smerf.use(middleware).handler(handlerGET)
export const POST = smerf.use(middleware).handler(handlerPOST)
```

If we use `export const _middleware` the `smerf build` command automatically attaches that middleware to the handlers. The below is the same as the above.

```ts
// ./src/handlers/http/hello/world.ts

import { createJSONResponse } from '@helloextend/api-utils'
import { createHttpHandler, createHttpMiddleware } from '@helloextend/smerf'

const handlerGET = createHttpHandler(async (_req, _ctx) => {
  return createJSONResponse({ data: 'GET World' })
})

const handlerPOST = createHttpHandler(async (_req, _ctx) => {
  return createJSONResponse({ data: 'POST World' })
})

export const _middleware = createHttpMiddleware(async (_req, _ctx, next) => {
  const res = await next()
  res.headers.set('X-Powered-By', 'Extend')
  return res
})

export const GET = handlerGET
export const POST = handlerPOST
```

```bash
# test.rest

GET {{baseUrl}}/world

###
POST {{baseUrl}}/world
```

```bash
HTTP/1.1 200 OK
content-type: application/json
x-powered-by: Extend
content-length: 20
Date: Tue, 19 Dec 2023 15:19:57 GMT
Connection: close

{
  "data": "GET World"
}



HTTP/1.1 200 OK
content-type: application/json
x-powered-by: Extend
content-length: 21
Date: Tue, 19 Dec 2023 15:19:20 GMT
Connection: close

{
  "data": "POST World"
}
```

If we have some middleware that we want attached to multiple endpoints, we create a `_middleware.ts` file.  If we want that middleware only attached to certain endpoints, we can place it in that specific folder; i.e. if it is under http folder, it will impact everything. The middleware in this file runs before other middleware defined in the handlers.

```ts
// ./src/handlers/http/_middleware.ts

// If we have some middleware that we want attached to every endpoint,
// we create a `_middleware.ts` file

import { extendDefaultMiddleware } from '@helloextend/api-utils'
import { createHttpMiddleware } from '@helloextend/smerf'

const requestTimingMiddleware = createHttpMiddleware(
  async (_req, _ctx, next) => {
    const startTime = Date.now()
    console.log(
      `(common middleware) Request started at ${new Date(
        startTime,
      ).toISOString()}`,
    )

    const response = await next()
    console.log('Common middleware after')

    const endTime = Date.now()
    const duration = endTime - startTime
    console.log(
      `(common middleware) Request ended at ${new Date(
        endTime,
      ).toISOString()} with duration ${duration}ms`,
    )

    response.headers.set('X-Request-Duration', `${duration}ms`)

    return response
  },
)

export default [extendDefaultMiddleware(), requestTimingMiddleware]
```

#### Example of creating middleware specific to a route

```ts
// ./src/handlers/http/hello/[name]/index.ts

import { createJSONResponse } from '@helloextend/api-utils'
import { createHttpHandler, getUrlParams } from '@helloextend/smerf'

const handler = createHttpHandler(async (_req, ctx) => {
  const { name } = await getUrlParams(ctx)
  return createJSONResponse(`Hello ${name}`)
})

export const GET = handler
```

```ts
// ./src/handlers/http/hello/[name]/about.ts

import { createJSONResponse } from '@helloextend/api-utils'
import { createHttpHandler, getUrlParams } from '@helloextend/smerf'

const handler = createHttpHandler(async (_req, ctx) => {
  const { name } = await getUrlParams(ctx)
  return createJSONResponse({ data: `About ${name}` })
})

export const GET = handler
```

```ts
// ./src/handlers/http/hello/[name]/_middleware.ts

import { NotFound } from '@helloextend/api-utils'
import { createHttpMiddleware, getUrlParams } from '@helloextend/smerf'

export default createHttpMiddleware(async (req, ctx, next) => {
  const { name } = await getUrlParams(ctx)
  if (name === 'fake') {
    throw new NotFound()
  }

  return await next()
})
```



```bash
###
GET {{baseUrl}}/hello/murat

###
GET {{baseUrl}}/hello/murat/about

###
GET {{baseUrl}}/hello/fake
```

```bash
HTTP/1.1 200 OK
content-type: application/json
x-request-duration: 2ms
content-length: 13
Date: Tue, 19 Dec 2023 16:29:29 GMT
Connection: close

"Hello murat"

###

HTTP/1.1 200 OK
content-type: application/json
x-request-duration: 2ms
content-length: 22
Date: Tue, 19 Dec 2023 16:29:46 GMT
Connection: close

{
  "data": "About murat"
}

###

HTTP/1.1 404 Not Found
content-type: application/json
content-length: 81
Date: Tue, 19 Dec 2023 16:30:00 GMT
Connection: close

{
  "code": "resource_not_found",
  "message": "The resource requested cannot be found."
}

```

#### Testing

Define the request, context arguments.Feed them to the handler, check the result.

With shallow testing, we test the handler directly and leave out the middleware.

With deep testing, we use the version of the handler in the .smerf folder, which includes the middleware.

```ts
// ./src/handlers/http/world.test.ts

import { makeTestHttpContext, makeTestRequest } from '@helloextend/smerf'
import { GET, POST } from './world'
// for Deep testing, we use the handler with the middleware
import handlerGET from '../../../.smerf/handlers/http/world.GET'
import handlerPOST from '../../../.smerf/handlers/http/world.POST'

// Define the request, context arguments.Feed them to the handler, check the result.

describe('world', () => {
  it('Shallow testing - tests handler directly, leaves middleware out', async () => {
    const req = makeTestRequest()
    const ctx = makeTestHttpContext()

    const res = await GET(req, ctx)
    const result = await res.json()
    expect(res.status).toBe(200)
    expect(result).toEqual({ data: 'GET World' })

    const postRes = await POST(req, ctx)
    const postResult = await postRes.json()
    expect(postRes.status).toBe(200)
    expect(postResult).toEqual({ data: 'POST World' })
  })

  it('Deep testing GET', async () => {
    const req = makeTestRequest()
    const ctx = makeTestHttpContext()

    const res = await handlerGET(req, ctx)
    res //?
    const result = await res.json()
    expect(res.status).toBe(200)
    expect(result).toEqual({ data: 'GET World' })

    // if we test this here, we'll get a middleware error because of the repetition of the middleware
    // we would use a different it block
    // const postRes = await handlerPOST(req, ctx)
    // const postResult = await postRes.json()
    // expect(postRes.status).toBe(200)
    // expect(postResult).toEqual({ data: 'POST World' })
  })

  it('Deep testing POST', async () => {
    const req = makeTestRequest()
    const ctx = makeTestHttpContext()
    const postRes = await handlerPOST(req, ctx)
    const postResult = await postRes.json()
    expect(postRes.status).toBe(200)
    expect(postResult).toEqual({ data: 'POST World' })
  })
})
```



### Local development

#### Smerf mode

* Uses `smerf build` to create the `manifest.json` file to define the routes.
* Uses env vars from the .env file.
* Can mix local and AWS resources.
* Fastest, least like prod.

#### Local mode

* Uses local cdk files to define routes.
* Uses env vars from the .env file.
* Can mix local and AWS resources.
* Faster, less like prod.

#### Remote mode

* Uses local cdk files to define routes. 
* Pulls env vars from an environment (sandbox, dev).
* Uses AWS resources.
* Slower, but like prod.

### Converting traditional lambda handlers to Smerf

At `src/lambdas/api/best-health-check.ts` you will find `awsLambdaWrapperV1`. This converts Smerf Handler to AWS Lambda Handler. 

Which means we can write our old handlers in Smerf and then wrap them with `awsLambdaWrapperV1`. This way the old files can begin to use Smerf.

```ts
export default awsLambdaWrapperV1(handlerWithVersioning)
```

### Using traditional lambda handlers and Smerf handlers together in CDK

For cdk, we might be importing our old lambdas from `../lambdas`, but for smerf we can import them from `../../.smerf` and use the `awsLambdaWrapperV1`. 

```ts
// ./src/cdk/lambdas.ts

// our traditional handlers
import { awsLambdaWrapperV1 } from '@helloextend/api-utils'
import bestHealthCheck from '../lambdas/api/best-health-check'
import productsGET from '../lambdas/api/products-get'
import TestGET from '../lambdas/api/test-apig-handler'

// smerf handlers
import IndexGETHandler from '../../.smerf/handlers/http/index.GET'
const IndexGET = awsLambdaWrapperV1(IndexGETHandler)

import IndexPOSTHandler from '../../.smerf/handlers/http/world.POST'
const IndexPOST = awsLambdaWrapperV1(IndexPOSTHandler)

import HelloNameHandler from '../../.smerf/handlers/http/hello/[name]/index.GET'
const HelloNameGET = awsLambdaWrapperV1(HelloNameHandler)

export {
  bestHealthCheck,
  productsGET,
  TestGET,
  IndexGET,
  HelloNameGET,
  IndexPOST,
}
```

```ts
// ./src/cdk/stacks/api.ts

// ...

		// our traditional handlers
    api.route({
      resourcePath: '/health',
      httpMethod: 'GET',
      name: 'Extend_API_GETHealth',
      handler: 'lambdas.bestHealthCheck',
    })

    api.route({
      resourcePath: '/products',
      httpMethod: 'GET',
      name: 'Extend_API_GETProducts',
      handler: 'lambdas.productsGET',
    })

    api.route({
      resourcePath: '/test',
      httpMethod: 'GET',
      name: 'Extend_API_GETTest',
      handler: 'lambdas.TestGET',
    })

		// smerf handlers
    api.route({
      resourcePath: '/',
      httpMethod: 'POST',
      name: 'Extend_API_POSTIndex',
      handler: 'index.IndexGET',
    })

    api.route({
      resourcePath: '/hello/{name}',
      httpMethod: 'GET',
      name: 'Extend_API_GETHelloName',
      handler: 'index.HelloNameGET',
    })

    api.route({
      resourcePath: '/',
      httpMethod: 'POST',
      name: 'Extend_API_POSTIndex',
      handler: 'index.IndexPOST',
    })
```

### meta: using `SmerfHttpV1Builder`

With it, our smerf handlers do not need to be defined in cdk lambdas and in the api gateway stack.



```ts
// ./src/cdk/lambdas.ts

// our traditional handlers
import { awsLambdaWrapperV1 } from '@helloextend/api-utils'
import bestHealthCheck from '../lambdas/api/best-health-check'
import productsGET from '../lambdas/api/products-get'
import TestGET from '../lambdas/api/test-apig-handler'

// import IndexGETHandler from '../../.smerf/handlers/http/index.GET'
// const IndexGET = awsLambdaWrapperV1(IndexGETHandler)

// import IndexPOSTHandler from '../../.smerf/handlers/http/world.POST'
// const IndexPOST = awsLambdaWrapperV1(IndexPOSTHandler)

// import HelloNameHandler from '../../.smerf/handlers/http/hello/[name]/index.GET'
// const HelloNameGET = awsLambdaWrapperV1(HelloNameHandler)

export {
  bestHealthCheck,
  productsGET,
  TestGET,
  // IndexGET,
  // HelloNameGET,
  // IndexPOST,
}

```

```ts
// ./src/cdk/stacks/api.ts

// ...

		// our traditional handlers
    api.route({
      resourcePath: '/health',
      httpMethod: 'GET',
      name: 'Extend_API_GETHealth',
      handler: 'lambdas.bestHealthCheck',
    })

    api.route({
      resourcePath: '/products',
      httpMethod: 'GET',
      name: 'Extend_API_GETProducts',
      handler: 'lambdas.productsGET',
    })

    api.route({
      resourcePath: '/test',
      httpMethod: 'GET',
      name: 'Extend_API_GETTest',
      handler: 'lambdas.TestGET',
    })

    // api.route({
    //   resourcePath: '/',
    //   httpMethod: 'POST',
    //   name: 'Extend_API_POSTIndex',
    //   handler: 'index.IndexGET',
    // })

    // api.route({
    //   resourcePath: '/hello/{name}',
    //   httpMethod: 'GET',
    //   name: 'Extend_API_GETHelloName',
    //   handler: 'index.HelloNameGET',
    // })

    // api.route({
    //   resourcePath: '/',
    //   httpMethod: 'POST',
    //   name: 'Extend_API_POSTIndex',
    //   handler: 'index.IndexPOST',
    // })

    // This is the Smerf Beta CDK Construct. Routes defined in /src/handlers will be automatically added to the API Gateway. Comment this out and uncomment other stuff if you don't want to use it.
    const smerfApp = SmerfHttpV1Builder.fromManifest(
      this.resource,
      'SmerfApp',
      SMERF_MANIFEST_PATH,
      { apiBuilder: api },
    )
    smerfApp.build()
```

At this point local mode behaves 1:1 with smerf mode. 

### 






