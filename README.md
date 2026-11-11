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
