// Class and OOP Concepts Example

class Person {
  constructor(firstname, lastname, age) {
    this.firstname = firstname;
    this.lastname = lastname;
    this.age = age;
    this.adult = null;

    // Methods declared inside the constructor are unique to each instance
    this.getFullName = function () {
      return `${this.firstname} ${this.lastname}`;
    };
  }

  // Methods declared outside the constructor are shared across all instances
  isAdult() {
    if (this.age >= 18) {
      this.adult = true;
    } else {
      this.adult = false;
    }
    console.log(this.adult);
    return this.adult;
  }

  // 'this' object refers to the current instance of the class and can be referenced within methods to access instance properties and other methods. Additionally, if 'this' is declared outside of the constructor, it will automatically refer to the instance of the class because of how JavaScript handles context within class methods.
}

// Example 2:

class Animal {
  //Unlike the example above, private fields are declared with a '#' prefix and are only accessible within the class they are defined in. This is to ensure encapsulation and data hiding.In the example above, user can technically mutilate the properties of the Person class from outside the class, whereas in this Animal class, the private fields cannot be accessed or modified directly from outside the class. Rule of thumb is to always change data by methods because it keeps data safe.
  #name;
  #species;
  #extinct;
  #id;
  #feet;

  constructor(name, species, feet, superPrivateData) {
    // The private variable below is scoped to the constructor function only and cannot be accessed outside of it. It can still be used within the constructor to initialize or manipulate data as needed through methods. However, unlike # private fields, it cannot be referenced in other methods outside the constructor.
    const _superPrivateData = superPrivateData; // Constructor-scoped only

    // If any private fields are attempted to be accessed outside the class, it will result in a syntax error.
    this.#name = name;
    this.#species = species;
    this.#extinct = null;
    this.#id = null;
    this.#feet = feet;

    this.findID = function () {
      this.#id = `${this.#name.toLowerCase()}-${Math.floor(
        Math.random() * 1000
      )}`;
      return this.#id;
    };
  }

  // Methods declared outside the constructor are shared across all instances
  isBipedal() {
    if (this.#feet === 2) {
      return true;
    } else {
      return false;
    }
  }
}

// Example usage:
const dog = new Animal("Dog", "Canine", 4);
console.log(dog.isBipedal()); // false
console.log(dog.findID()); // e.g., dog-123
