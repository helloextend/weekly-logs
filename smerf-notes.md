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

The `createHttpHandler` abstraction is possibly looking like this. 
TODO: verify this assumption

```ts
/**
 * createHttpHandler - A utility function to create an HTTP request handler.
 * @param {Function} handlerFunction - A function that takes a request and context object, and returns a response.
 * @returns {Function} A function that can be used as an HTTP request handler.
 */
function createHttpHandler(handlerFunction) {
  return async (req, res) => {
    try {
      // Extract necessary information from the request object
      // Context can be built based on the needs (e.g., authentication, logging)
      const context = {}

      // Execute the handler function with the request and context
      const response = await handlerFunction(req, context)

      // Send the response back to the client
      res.statusCode = response.statusCode || 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(response.body))
    } catch (error) {
      // Handle any errors that occur during the request handling
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Internal Server Error' }))
    }
  }
}
```

The `createJSONResponse` abstraction is possibly looking like this.
TODO: verify this assumption

```ts
/**
 * createJSONResponse - A utility function to create a JSON response.
 * @param {Object | string} data - The data to be sent in the response.
 * @param {number} statusCode - Optional HTTP status code, defaults to 200.
 * @returns {Object} An object representing the HTTP response.
 */
function createJSONResponse(data, statusCode = 200) {
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