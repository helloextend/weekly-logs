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

TODO: compare with how middleware was traditionally done with middy

Middleware functions are commonly used to process requests and responses, often performing tasks like: 

* logging
* authentication
* modifying requests/responses

They solve the challenge of attaching functionality before and after a request/response.

Middleware ordering: 

* On the way in to the handler : middleware get executed in order : 1, 2, 3
* On the way out of the handler: middleware get executed in reverse: 3, 2, 1

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/jfqayg3srnbv2w98ocpc.png)

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

### Router

Like Next.js.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/i0h7oqlqqbjo4s8yf9zd.png)

### Local development





### Application from code

When the smerf build command runs, a `manifest.json` file is created, which powers cdk. 

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/cy4xbil3vzsrwoak9e4u.png)

