# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`tangled-advertisement` is a Node.js peer-to-peer advertisement node for the millix network. It runs alongside a local millix node: it reads the millix node's SQLite database and calls its HTTPS API to pay for and settle ad impressions in millix (MLX). A node can act as an advertiser (it has ads in its advertiser DB), as a consumer (it receives and renders ads and gets paid), or both.

## Commands

```bash
npm install
npm run build     # webpack: bundles src/ into lib/tangled-advertisement.js (lib/ is gitignored)
npm start         # runs lib/tangled-advertisement.js --debug=true --data-folder=./millix-tangled/
```

- You must build before you start. `npm start` runs the bundle, not `src/`.
- There are no tests or lint scripts. `npm test` is the npm placeholder that exits with an error.
- CLI flags, parsed with yargs in `src/index.js`: `--data-folder`, `--port`, `--port-api`, `--bind`, `--host`, `--host-force`, `--initial-peers host:port ...`, `--pid-file`, `--debug=true`, `--nat-pmp=false`.
- A relative `--data-folder` is resolved against the **home directory**, not the cwd, so `npm start` uses `~/millix-tangled/`.

### Runtime prerequisites

Startup fails and retries every 5s (`src/core/service.js`) unless these are present:
- In the data folder: `millix.sqlite` (owned by the millix node), plus `node.json`, `node_certificate_key.pem` and `node_certificate.pem` (node key and TLS cert, shared with the millix node).
- A millix node API reachable at `https://localhost:5500` (`src/api/client.js`). Credentials come from `src/environment.js` (gitignored; copy `src/environment.js.example`) or from `node.json`.

## Build details

- Babel (`@babel/preset-env` + class properties) via webpack in `development` mode with inline source maps and `retainLines`.
- `.sql` files are imported as raw strings (`asset/source`). That is how migrations and init scripts are loaded with `require('./x.sql')`.
- The `sqlite3` native binding is aliased to `src/database/sqlite3/sqlite3-binding.js`, and `node_sqlite3.node` is copied into `lib/build/`. Keep this intact when upgrading `sqlite3`.

## Architecture

### Startup sequence (`src/core/service.js`)
`database.initialize` → `configLoader.load` → `database.checkup` → MLX/USD price task (fiatleak) → `ntp.initialize` → `peer.initialize` → `network.initialize` → `api.initialize`. If any step fails, everything stops and the whole sequence retries after 5s.

Most modules are singletons (`export default new X()`) that talk to each other through direct imports and the global `eventBus` (`src/core/event-bus.js`, a plain `EventEmitter`).

### Configuration (`src/config/`)
- `config.js` holds the code defaults. Only keys in its **default export object** count as config.
- `config-loader.js` saves every config key to the `config` table on first run. After that, **database values override both the code defaults and the CLI flags** applied in `index.js`. So changing a default in `config.js`, or passing `--port`, may have no effect on an existing data folder.
- Three keys always come from code: `DATABASE_CONNECTION`, `TRANSACTION_OUTPUT_MAX` and `NODE_INITIAL_LIST`.

### Database (`src/database/`)
- There are four SQLite files in the data folder. `tangled.sqlite` is the main connection, and the other three are `ATTACH`ed to it under these schema names: `advertisement_advertiser`, `advertisement_consumer` and `millix`.
- SQL must use schema-qualified table names, such as `advertisement_consumer.advertisement_queue` or `millix.wallet`.
- The `millix` schema is the millix node's own database. Treat it as read-only.
- Repositories live in `repositories/`, are registered in `Database._initializeTables()` and are accessed with `database.getRepository('<name>')`.
- `Database.buildQuery` / `buildUpdate` turn a `where` object into SQL using key suffixes:
  - `_begin`/`_min` → `>=`
  - `_end`/`_max` → `<=`
  - `_in` → `IN (...)`
  - a key ending in `!` with value `null` → `IS NOT NULL`
- Use `runBatchAsync` (mutex-locked `BEGIN`/`COMMIT`) for multi-statement writes.
- **Schema changes:**
  - New installs run `scripts/initialize-*.sql`, which already contain the full current schema and set the version.
  - Existing installs apply `migration/schema-update-N.sql` one after another until they reach `DATABASE_CONNECTION.SCHEMA_VERSION`.
  - Adding a change therefore means all of the following:
    1. Add `schema-update-<N+1>.sql`, wrapped in a transaction and updating `schema_information`.
    2. Mirror the change in the matching `initialize-*.sql`.
    3. Bump the version in both `config.js` and `initialize-tangled.sql`.
  - An optional `schema-update-N.js`, whose default export has `migrate(db, data)`, overrides the default runner. `?name` placeholders in migration SQL are substituted.

### HTTP API (`src/api/`)
- An Express app served over **HTTPS** on `NODE_PORT_API` (15555), using the node certificate.
- Endpoints are declared in `src/config/api.json`. Each has an opaque 16-character `id`, which is also the folder name: `src/api/<id>/index.js`.
- At startup, `server.js` upserts every entry into the `api` table, then `require`s each folder. If a folder is missing, its row is deleted.
- Each endpoint module exports a singleton subclass of `Endpoint` (`endpoint.js`) that calls `super('<id>')` and implements `handler(app, req, res)`. It is mounted on both GET and POST at `/api/<id>`.
- The `permission` field is parsed but not enforced.
- To add an endpoint, create a new id in `api.json` and a matching folder.
- `client.js` is the outbound client to the local millix node (wallet info, sending transactions, and reading transaction outputs for payment verification). `fiatleak/` fetches the MLX price.

### Logging
`src/core/console.js` monkey-patches `console.log`: output is **suppressed unless `--debug=true`** (`MODE_DEBUG`). Log lines start with a `[module]` tag (`[peer]`, `[network]`, `[database]`, …), which `DEBUG_LOG_FILTER` can match to show only some modules.

## P2P network and ad propagation (`src/network/`)

`network.js` is the transport: sockets, discovery and the handshake. `peer.js` is the protocol: every message handler and every recurring ad and payment job. They are connected only through `eventBus`. `network._onWebsocketMessage` parses `{type, content}` JSON and calls `eventBus.emit(type, content, ws)`, and `peer.initialize()` subscribes to each `type`.

### Roles
- **Advertisement provider:** a node with `config.ADVERTISEMENT_PROVIDER` set, or with at least one row in `advertisement_advertiser.advertisement` (counted at startup and cached). Providers answer ad requests and pay consumers.
- **Consumer:** any node. It requests ads, asks the advertiser to pay for each ad before showing it, and serves paid ads through the local API.
- **Ad network** (schema 12): a consumer-side node that buys impressions in bulk from advertisers and resells them to websites ("webmasters"). See [Ad-network flow](#ad-network-flow-advertisement_network-messages).

### Transport and topology (`network.js`)
- Each node runs a `ws` server on `NODE_PORT` (15550), with NAT-PMP mapping unless `--nat-pmp=false`, and dials out to other peers. P2P links are plain `ws://` with no TLS. Only the HTTP API uses TLS.
- **Handshake:** both sides send `node_handshake` as soon as the socket opens. It carries `node_id` (derived from the public key in `node.json`), a per-process random `connection_id`, `advertisement_provider` and the node's public address. `_onNodeHandshake` then does the following:
  - closes self-connections and remembers them so they aren't dialed again;
  - closes the link if **neither side is a provider**;
  - closes the new socket if its `connection_id` is already registered;
  - records the peer in the `node` table and emits `peer_connection`.
- **Registries:**
  - `_nodeRegistry[nodeID]` and `_connectionRegistry[connectionID]` each map to a list of sockets.
  - `registeredClients` holds the first socket of each node. Every broadcast goes through it.
- **Peer gossip:** on `peer_connection`, `peer.sendPeerList` sends the new peer a `new_peer` message for every connected peer, and `notifyNewPeer` announces the new peer to everyone else. The per-connection cache `peer_list_<connectionID>` suppresses repeats, and re-announcements happen at most once every 10 minutes.
- **Reconnection:** every 10s, `retryConnectToInactiveNodes` (all known but disconnected nodes) and `retryConnectToOnlineNodes` (gossiped nodes seen in the last 10 minutes) dial up to 4 nodes at a time. After 10 failed dials, an address is skipped for 10 minutes.
- **Which peers get dialed:** `addNode` ignores a non-provider peer unless this node is itself a provider. `NODE_INITIAL_LIST` entries are always added. Nodes reloaded from the `node` table at startup are added with no provider flag, so only providers redial them. As a result, **a pure consumer dials the boot nodes plus any provider it hears about through `new_peer`**. Providers dial everything they hear about.
- The result is that consumers hang off providers and providers mesh with each other. A consumer↔consumer link never survives the handshake.

### Routing: flood requests, return responses by reverse path (`peer.js`)
- **Requests are flooded.** On receiving a request, a node does three things:
  - records `request_guid → ws` (the socket it came from) in a `_proxy*Queue`;
  - re-broadcasts the request with `propagateRequest(type, content, excludeWS, excludeNonAdvertisementProvider=true)`, which skips the sender and every non-provider peer;
  - handles the request itself if it is a provider.
- **Responses come back by the reverse path.** If the `request_guid` is in this node's own `_advertisement*Queue`, the node consumes the response. If it is in a `_proxy*Queue`, the node forwards it only to the stored socket. Otherwise it drops it.
- **Exceptions:** an advertiser broadcasts `advertisement_payment_response` to all peers, and from there it follows the reverse path. `advertisement_payment_new` is flooded to everyone, and every node that receives it processes it.
- **Deduplication and replay protection:** `shouldBlockMessage` drops a message in any of these cases:
  - it has no `message_guid`;
  - its `message_guid` is already in `_messageQueue` (for requests, `message_guid = request_guid`);
  - its `timestamp` is more than 30s older than `ntp.now()`.

  The 30s window is the only bound on how far a flood travels. All in-memory queues are pruned every 5s, with a default TTL of 30s.
- **Rate limits per sender** (`_deviceMessageQueue`, 60s TTL):
  - one `advertisement_request` per `device_id`;
  - one sync request per `node_id`;
  - five payment-response resends per `device_id`.
- Always stamp outgoing messages with `ntp.now()` and a fresh `message_guid` (`Database.generateID(32)`), or receivers will drop them.

### Ad lifecycle: consumer ↔ advertiser
1. **Request.** Every 60s, and once 15s after boot, `requestAdvertisement` floods `advertisement_request` with `{node_id, node_ip_address, protocol_address_key_identifier, device_id, request_guid}`. A provider handles it in `_onAdvertisementRequest`:
   1. **Rejects** the request if:
      - the IP is throttled;
      - `device_id` or `protocol_address_key_identifier` is missing;
      - the key identifier is for the wrong network. Mainnet requires it to start with `1`, and `MODE_TEST` requires the opposite.
   2. **Selects** every active ad that has no active `advertisement_request_log` row for this consumer node or device (`syncAdvertisementToConsumer`). So **each ad goes to a given consumer at most once** until its log row is deactivated.
   3. **Enforces the IP cap and checks the IP.** It serves nothing to an IP that already has `ADS_TRANSACTION_IP_MAX` (8) active log rows for any one ad. It also validates the consumer IP against `EXTERNAL_API_IP_CHECK`, and caches the result per IP for 12 hours in `_ipAddressesValidation`.
   4. **Logs and replies.** It writes one request-log row per ad, then sends back `advertisement_new` with the full ad objects, their attributes, and its own `node_id`, IP and port.

   The consumer (`_onNewAdvertisement`) inserts each ad with `bid_impression_mlx ≥ ADS_TRANSACTION_AMOUNT_MIN` into `advertisement_consumer.advertisement_queue`, with `creative_request_guid = request_guid`.
2. **Sync.** Every 60s, consumers flood `advertisement_sync_request`. Providers reply with `advertisement_sync`, listing every ad that still has an active request log for that consumer (`listConsumerActiveAdvertisement`). This lets a consumer rebuild a lost queue. The consumer stores these ads the same way as in step 1.
3. **Payment request (consumers are paid before they show an ad).** Every 30s, `processAdvertisementQueue` does two things:
   - It re-broadcasts `advertisement_payment_request` (`{advertisement_guid, request_guid, device_id}`) for every queued ad whose payment was requested but not received.
   - If 10 or fewer are outstanding, it requests payment for up to 10 more ads (`getRandomAdvertisementToRequestPayment`). It picks at most one ad per advertiser, and skips any advertiser that still has a requested ad this consumer hasn't shown yet.

   A request that gets no payment within 150s is reset so it can be retried. On the advertiser side, `_onAdvertisementPaymentRequest` acts only if it owns the ad (the in-memory GUID cache), then does one of the following:
   - **No matching request-log row:** it replies `creative_request_not_found` or `advertisement_not_found`, and the consumer deletes the queued ad.
   - **Already paid:** it re-sends the existing payment details as `advertisement_payment_response`.
   - **Otherwise:** it inserts a pending `advertisement_ledger` row, which has `tx_address_deposit_vout_md5 IS NULL`. The number of pending rows is capped by `ADS_PAYMENT_BACKLOG_MAX`.
4. **Batched settlement.** `processAdvertisementPayment` runs every 60s, or immediately once the backlog reaches `TRANSACTION_OUTPUT_MAX`. It does the following:
   1. takes up to 126 pending ledger rows;
   2. pays each consumer's `protocol_address_key_identifier` in **one millix transaction** through the local millix node (`client.sendTransaction`), with one output per ad plus a fee output;
   3. stores the transaction id and output position as ledger attributes;
   4. floods `advertisement_payment_new` with the list of ledger entries.

   Each consumer whose queue holds a matching unpaid `(creative_request_guid, advertisement_guid)` records it in `settlement_ledger` and marks the ad paid. On the advertiser, pending rows still unpaid after 120s are deleted.
5. **Render.** The API endpoint `get_next_consumer_advertisement_render` (`LMCqwVXTLS7VRWPT`) returns a random queued ad that is **paid and has never been shown**, then records the impression. Clicks are logged on the advertiser through `log_advertisement_click` (`JPMvLLnqBYtadpH2`).
6. **Expiry.** Consumer queue rows are pruned after `ADS_PRUNE_AGE` (1 day). Advertiser request-log rows **stay active indefinitely**. Only `reset_ad` (`pKZdzEZrrdPA1jtl`) deactivates them, and only rows older than 1 day. Resetting is the only way an ad can be served again to the same consumer, device or IP, and it also lifts the IP cap.

### Ad-network flow (`advertisement_network:*` messages)
1. **Setup, through the API:**
   - The advertiser registers the networks it will fund with `add_advertisement_network`, which writes `advertisement_advertiser.advertisement_network` with a daily MLX budget and the network's payout address.
   - The network node registers the advertisers it accepts with `add_advertisement_network_publisher`, and the websites it serves with `add_advertisement_network_webmaster` (domain, plus an optional callback URL).
2. **Request.** Every 60s, the network node floods `advertisement_network:advertisement_request`, listing its publisher GUIDs in `advertisement.advertisement_network_publisher`.
3. **Allocation and upfront payment.** An advertiser handles the request only if its own `node_id` is in that list and the requester is one of its active networks. Then it does the following:
   1. computes the remaining daily budget from active `advertisement_network_request_log` rows, which expire after 1 day;
   2. if at least 50,000 MLX remain, allocates impressions round-robin across its active ads, cheapest first;
   3. **pays for all of them upfront, in one transaction** to the network's address;
   4. logs the allocations;
   5. replies with `advertisement_network:advertisement_sync`, listing **all** its active allocations to that network (earlier ones and new ones) grouped by ledger entry (tx id, output position, deposit).
4. **Payment verification.** The network stores the allocations in `advertisement_network_queue`. Every 60s, `advertisementNetworkCheckPayment` asks the millix node whether each transaction output is stable, not double-spent, and pays the expected address and amount. Only then does it set `payment_received_date`.
5. **Serving and payout.** Websites call `get_next_advertisement_network_webmaster_advertisement_render` (`NJMykmvfNICmggfT`), and the HTTP Referer must match the webmaster's domain. The endpoint returns a paid ad that still has impressions left and hasn't been shown to that `webmaster_target_guid`, and queues a payout for the webmaster. Every 60s, `processWebmasterAdvertisementPayment` pays all pending webmaster payouts in one transaction. Webmaster queue rows expire after 1 day.

### Recurring jobs
Every recurring job is scheduled in `peer.initialize()` and `network.initialize()` with `task.scheduleTask(name, fn, intervalMs, isAsync, once)`. When `isAsync` is true, the function must return a promise, because the next run is scheduled only after it settles.

### Adding a message type
1. Send `{type, content}` with `_sendData(ws, …)` or `propagateRequest(…)`. Include `message_guid` and `timestamp: ntp.now()`.
2. Register a handler with `eventBus.on(type, …)` in `peer.initialize()`.
3. In the handler, call `shouldBlockMessage` first and record the `message_guid` in `_messageQueue`.
4. If the message expects a reply, add a proxy-queue entry so the reply can find its way back.

## Code style

Follow `.editorconfig`: 4-space indent, LF line endings, 120 columns, IntelliJ-style formatting with aligned `=`/`:` in consecutive assignments and object literals. The code uses ES modules transpiled by Babel, lodash/async for control flow, and promise chains rather than async/await.
