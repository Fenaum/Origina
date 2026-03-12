// Closure Definition: A closure is a feature in JavaScript where an inner function has access to the outer (enclosing) function's variables and parameters, even after the outer function has returned. Closures are created whenever a function is defined inside another function, allowing the inner function to "remember" the environment in which it was created.

// example and analogy: think of baton race where each runner (inner function) carries the baton (variables from the outer function) and can pass it along to the next runner, even after the first runner has finished.

// A mini Express-like framework using closures to manage middleware. Closure is important to the functioning of this code because it allows the `next` function to maintain access to the `index` variable and the `middlewareStack` array even after the `listen` function has completed execution. This enables the middleware functions to be called in sequence, as each call to `next` increments the `index` and retrieves the next middleware function from the stack. In Backend development, this pattern is commonly used in web frameworks to handle HTTP requests through a series of middleware functions, allowing for modular and reusable code.

function createMiniExpress() {
    // Middleware stack to hold the functions added via the "use" method. This ensure that the middleware functions are preserved across multiple calls to the "listen" method.
  const middlewareStack = [];

  return {
    // "use" method to add middleware functions to the stack. This doesn't execute them immediately; it just stores them for later use.
    use: (fn) => middlewareStack.push(fn),

    // "listen" method to simulate handling an incoming request. It executes the middleware functions in the order they were added.
    listen: (req, res) => {
    // Each request begins with index 0 to start from the first middleware function.
      let index = 0;

      // "next" function to move to the next middleware in the stack. This function is crucial for chaining middleware functions together.
      const next = () => {
        // Assign the current middleware function from the stack.
        const currentFunction = middlewareStack[index];

        // Move the index forward for the next middleware call.
        index++;

        // Assign and call the current middleware function, passing in req, res, and next. This allows each middleware to process the request/response and then call next() to proceed to the next middleware. Closure is what allows the next function to access the index and middlewareStack variables even after listen has finished executing.
        if (currentFunction) {
          currentFunction(req, res, next); // next is included as a parameter to allow the middleware to call it. This is an example of how closures enable the middleware functions to maintain access to the variables defined in the outer scope of the listen function, allowing for a seamless flow of control through the middleware stack. In short, this allow next() function to be accessed outside of its original scope, enabling the chaining of middleware functions in a way that is essential for handling HTTP requests in a backend application.
        }
      };

      // Initiate the middleware chain by calling
      next();
    },
  };
}

const app = createMiniExpress();

// Middleware 1

// We are passing in a function to the "use" method that takes req, res, and next as parameters. This function logs the request method and URL, then calls next() to pass control to the next middleware in the stack.The parameters are placeholders that represent the request and response objects, as well as the next function to call the subsequent middleware. In short, we are expecting the framework to provide these parameters when executing the middleware.
app.use((req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url}`);
  next();
});

// Middleware 2
app.use((req, res, next) => {
  res.customHeader = "X-Custom-Header: MiniExpress";
  next();
});

// Middleware 3
app.use((req, res, next) => {
  res.body = "Hello from MiniExpress!";
  console.log(res.customHeader);
  console.log(res.body);
});

// --- THE FIX: CALL THE METHOD ---
// We create "mock" objects to represent the browser request and server response. In a real backend application, these would be provided by the web server when handling an actual HTTP request.
const mockRequest = { method: "GET", url: "/profile" };
const mockResponse = {};

// We call the listen method on our mini Express app, passing in the mock request and response objects. This starts the middleware processing chain, demonstrating how each middleware function is executed in order.
app.listen(mockRequest, mockResponse);

// Finally, the importance of Closure in this code lies in its ability to maintain the state of the middleware stack and the current index across multiple calls to the next function. This allows for a clean and efficient way to handle a sequence of middleware functions, which is a common pattern in backend web development.