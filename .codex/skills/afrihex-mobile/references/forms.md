# Forms

Use `react-hook-form` and `zod` for non-trivial forms:

- login
- register
- directions
- certificate verification
- profile/address link creation

Rules:

- Keep validation messages short and field-specific.
- Disable submit while a mutation is pending.
- Preserve user input when a request fails.
- Put schema definitions near the screen unless shared across screens.
- Use typed form values.
- Validate required values, length constraints, formatting, and domain-specific rules.
- Use appropriate keyboard types and return-key behavior.
- Prevent duplicate submissions.
- Do not trust client-side validation as a security boundary.
- Keep important fields and primary actions reachable while the keyboard is visible.

Important flows:

- Login/register store `data.token`.
- Directions must validate origin and destination.
- Certificate verification must not require login.
- Profile creation must resolve destination before submit.
