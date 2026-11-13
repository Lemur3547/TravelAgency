# TravelAgency

## Database migrations

Run backend commands from `backend/`:

```bash
alembic upgrade head
```

For an existing database whose schema already matches the application models,
mark it as the initial revision:

```bash
alembic stamp 0001_initial_schema
```

Set `DATABASE_URL` before either command to migrate a database other than
`backend/travel_agency.db`. New databases are initialized by `alembic upgrade head`;
the API does not create or alter tables at startup.

## Backend environment

Copy `backend/.env.example` to `backend/.env` and set `AUTH_SECRET_KEY` to a
private random value (`openssl rand -hex 32`). The API loads `backend/.env` on
startup; environment variables already set by the host take precedence. The
template includes the database URL, token lifetimes, cookie settings, and
activation link base URL. Never commit `backend/.env`.

## Destinations API

The destinations directory stores unique country-city pairs:

- `GET /api/destinations/` — list destinations.
- `GET /api/destinations/countries` — list countries and their slugs.
- `GET /api/destinations/{country_slug}/cities` — list cities in a country by slug.
- `POST /api/destinations/` — create a destination with `country`, `city`,
  `country_slug` and `city_slug`.

There are no update or delete operations for destinations.

## Tours API

Run `alembic upgrade head` from `backend/` to create the tours table. The
`/api/tours/` endpoints provide list, detail, create, update and delete
operations. Tours reference a tour operator and a destination, and meal types
are stored as a list of selected values.

`commission_percent` is the tour operator commission percentage of the client
price. The API calculates and persists `agency_price` (client price minus the
commission) and `agency_commission` (the commission amount) on create and update;
these calculated values are returned by the API and displayed in the tour form
and list.

## Employee accounts API

Run `alembic upgrade head` from `backend/` to create the employee, role, and
refresh-session tables and seed the four roles. The initial Director account
is created once through `POST /api/auth/setup`. The endpoint is available only
while the employees table is empty, accepts the Director's account details and
password, and immediately signs in the new account. After any employee has
been created, setup is permanently closed.

- `POST /api/auth/setup` — create and sign in the first Director. No invite
  token is required.
- `POST /api/auth/login` — accept `login` and `password`; returns the employee and
  sets HttpOnly `access_token` and `refresh_token` cookies.
- `POST /api/auth/refresh` — rotate the refresh cookie and issue a new access cookie.
- `POST /api/auth/logout` — revoke the refresh session and clear both cookies.
- `POST /api/auth/activate` — accept `invite_token` and a password of at least 12
  characters; activate the invited employee and set both auth cookies.
- `GET /api/admin/roles` — list roles that the signed-in administrator may assign.
- `POST /api/admin/employees` — register an employee without a password. The request
  contains `last_name`, `first_name`, optional `father_name`, `passport_number`,
  `login`, `email`, `phone`, and `role_id`. The response contains the employee
  and an `activation_url` with the one-time token.

An authenticated session cannot call `/api/auth/login`, `/api/auth/activate`, or
`/api/auth/setup`; call `/api/auth/logout` first.

Administrators may register either manager role. Directors may also register
Administrators; neither role can create a Director. Passport and phone values
use the existing validation rules. Passwords are Argon2-hashed, invite tokens
are stored as hashes, and refresh tokens are rotated and revocable.

Configure `AUTH_SECRET_KEY` with a persistent random secret in deployed
environments, `AUTH_COOKIE_SECURE=true` when serving over HTTPS, and
`ACTIVATION_URL_BASE` with the activation page URL. Without `AUTH_SECRET_KEY`,
the API generates a temporary process-local secret and all tokens become
invalid after a restart. `AUTH_COOKIE_SAMESITE` accepts `lax`, `strict`, or
`none`; `none` requires secure cookies.
