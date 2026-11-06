# Task: the API keys screen

Build the API keys screen of Acme Console in `index.html`. Add CSS or JavaScript files in this folder if you need them. Get data only through `api.js`, which documents its functions and the URL parameters that select its scenarios.

Developers use this screen to create a key for a script or service and to see which keys exist.

- List the account's keys: name, created date, and the last four characters.
- A form creates a key. Its text field is labelled exactly `Key name`, and its button is labelled exactly `Create key`. A name is required and is 3 to 40 characters long.
- The full secret is shown only once, right after the key is created, so the user must be able to copy it then.
- `createKey` can fail. The user must be able to recover from a failure.

Use the design system in `DESIGN.md`, `tokens.css`, and `app.css`. Plain HTML, CSS, and JavaScript modules only: no frameworks, packages, or build step.
