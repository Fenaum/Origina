// Promise Constructor Example

// simplified version of a Promise constructor
class MyPromise {
  // executor is a function that takes resolve and reject functions as arguments
  constructor(executor) {
    this.status = "pending";
    this.value = null;
    this.error = null;

      //having resolve and reject functions inside the constructor is important because they prevent external access to these functions, ensuring that the promise's state can only be changed by the executor function provided during instantiation.
    const resolve = (data) => {
      // Handle resolution
      this.value = data;
      // status property can be accessed to check the state of the promise by logging promise.status
      this.status = "resolved";
    };

    const reject = (error) => {
      // Handle rejection
      this.error = error;
      this.status = "rejected";
    };
    // Execute the provided executor function with resolve and reject
    executor(resolve, reject);
  }
  // This is the "Bridges" that connects the result to your console.log
  then(callback) {
    if (this.status === "resolved") {
      const nextValue = callback(this.value);
      // In a real promise, this would return a NEW MyPromise
      return new MyPromise((res) => res(nextValue));
    }
    return this;
  }

  catch(callback) {
    if (this.status === "rejected") callback(this.error);
    return this;
  }
}

function exPromise(data) {
    return new MyPromise((resolve, reject) => {
        const success = true; // Simulate success or failure
        if (success) {
            // the resolved value can be customized and is passed to the resolve function
            resolve({message: "Promise resolved successfully.", firstname: data.firstname, lastname: data.lastname});
        } else {
            // the error message can be customized and is passed to the reject function
            reject("Promise rejected with an error.");
        }
    });
}

exPromise({firstname: "John", lastname: "Doe"}).then((result) => {
    console.log(result.message); // Logs: Promise resolved successfully.
    console.log(`First Name: ${result.firstname}`); // Logs: First Name: John
    console.log(`Last Name: ${result.lastname}`); // Logs: Last Name: Doe
}).catch((error) => {
    console.error(error); // In case of rejection, logs the error message
}); 


// Note: This is a simplified implementation of a Promise for educational purposes and does not cover all aspects of the native JavaScript Promise.


