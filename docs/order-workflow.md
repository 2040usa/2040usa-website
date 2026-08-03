# Order workflow prototype

## Scope

Increment 1 is a browser-memory prototype. It collects enough structured information to demonstrate the intended customer journey, but it does not upload artwork, calculate pricing, create an order, reserve production capacity, accept payment, or send data anywhere.

## Starting routes

1. **Print-ready gang sheet:** an already arranged sheet at intended print dimensions.
2. **Separate artwork:** individual transparent designs with a width and quantity for each.
3. **Transfers by size:** one design with multiple width-and-quantity rows.
4. **Full apparel project:** garment source, apparel category, estimated quantity, and print locations.

Changing the starting route clears artwork acknowledgment and configuration belonging to the previous route so incompatible data cannot be reviewed together.

## Order steps

1. **Starting point (`/order/start`):** choose and explicitly confirm one route. A validated `route` query may preselect, but never auto-advances.
2. **Artwork (`/order/artwork`):** read route-specific preparation guidance and acknowledge it. There is no file input or simulated upload.
3. **Project details (`/order/configure`):** complete the route-specific React Hook Form. Zod validation blocks invalid forward navigation.
4. **Review (`/order/review`):** inspect the selected route, artwork acknowledgment, configuration, notes, and row counts. Edit links return to earlier steps without clearing compatible draft state.

There is no completion, confirmation, checkout, or payment step. The review page ends with an informational disabled control.

## In-memory state

The `/order` layout owns one vanilla Zustand store through React context. This avoids a module-global store that could be shared across server requests. Shared-layout preservation keeps the store alive during client navigation and browser Back/Forward. A full refresh creates a fresh draft; guards then redirect a later route to the earliest incomplete step.

The store deliberately distinguishes two configuration states:

- **Working configuration** contains the current React Hook Form values, including incomplete or temporarily invalid strings and dynamic rows. It restores Project Details after internal Back/Forward, progress-link, and Edit navigation, but it does not complete the step or unlock Review.
- **Completed configuration** is created only after the route-specific Zod schema accepts a normal Review Draft submission. Only this validated configuration completes Project Details, satisfies the Review guard, and appears in the Review summary.

Successful validation synchronizes both states. Changing the starting route or using Start Over clears both states. This working state is navigation continuity inside the mounted client layout, not durable persistence or a backend draft.

No local storage, cookies, URL payloads, server actions, or API routes are used.

## Future seams — not implemented

- **Anonymous authentication and backend drafts:** a later increment can associate a durable server-owned draft with an anonymous customer identity.
- **Artwork records and resumable uploads:** private artwork records can later connect to Uppy/TUS and private storage without changing the route-specific configuration union.
- **Server-owned pricing:** validated configuration can later become input to authoritative server pricing. The browser will not be the source of truth.
- **Submission and payments:** order creation and Stripe payment handling require separately approved server lifecycle work.

These seams describe future direction only; none are active in Increment 1.
