# Tickify booking performance baseline

These scripts exercise the real HTTP booking path against an isolated data set. They are baseline tools: do not compare output from different machines or data sizes as though it were a product SLO.

## Topology

- One Tickify API process, with `PERFORMANCE_DIAGNOSTICS_ENABLED=true`.
- MongoDB replica set, Redis, BullMQ expiration worker, and the normal Kafka/outbox worker should be running as they are in the target environment.
- k6 runs from a separate process. Record CPU model, RAM, Windows version, Node version, Docker resource limits, and service connection endpoints alongside `summary.json`.

## Seed and start

From `backend`, create an isolated data set and queue namespace. Performance jobs use local Redis DB 2 and an `order-expiration-perf-<run-id>` queue, so they cannot share the normal `order-expiration` queue:

```powershell
$env:PERFORMANCE_QUEUE_ISOLATION = 'true'
$env:PERFORMANCE_RUN_ID = 'baseline-001'
$env:REDIS_URL = 'redis://127.0.0.1:6380/2'
$env:URI = 'mongodb://127.0.0.1:27018/tickify_perf?replicaSet=rs0&retryWrites=true&w=majority'
npm run perf:prepare -- --run-id baseline-001 --reset --flash-sale-delay-seconds 90
$env:PERFORMANCE_DIAGNOSTICS_ENABLED = 'true'
npm run dev
```

The manifest is `perf/generated/baseline-001.json`. It contains only generated test credentials and scoped IDs. Remove all associated Mongo/Redis data with:

```powershell
npm run perf:prepare -- --run-id baseline-001 --cleanup
```

## Scenarios

Set `BASE_URL` to the API root (including `/api/v1`) and point `PERF_MANIFEST` to the generated manifest. k6 writes a machine-readable summary to `perf/results`.

```powershell
$env:BASE_URL = 'http://127.0.0.1:5000/api/v1'
$env:PERF_MANIFEST = '..\\generated\\baseline-001.json'
k6 run --summary-export perf/results/booking-baseline.json perf/booking-baseline.js
k6 run --summary-export perf/results/seat-contention.json perf/seat-contention.js
k6 run --summary-export perf/results/flash-sale.json perf/flash-sale.js
```

- `booking-baseline.js`: unique VUs load seat map and hold disjoint seats. Defaults: 50 VUs, one iteration each. Metrics: `hold_latency_ms`, HTTP throughput/latency, expected `409` rate, unexpected failures.
- `booking-preauthenticated.js`: a control version of the booking baseline. Each VU reuses its own short-lived token emitted by `seed-performance.ts`; it removes only `/auth/login` and bcrypt from the timed flow while preserving admission, concurrent seat-map requests, and hold.
- `login-decomposition.js`: login-only diagnostic workload. Start the API with both `PERFORMANCE_DIAGNOSTICS_ENABLED=true` and `PERFORMANCE_AUTH_DIAGNOSTICS_ENABLED=true`; diagnostics then include Mongo lookup, bcrypt compare, JWT generation, and residual response-route timings. Those sub-timers are disabled in every other environment.

Set `PERFORMANCE_HOLD_DIAGNOSTICS_ENABLED=true` alongside performance diagnostics to emit hold-path phase timings: validation/data lookup, Redis Lua, Mongo order creation, summary/status updates, expiration enqueue, and remaining controller work. These timers are disabled unless both flags are enabled.

The hold diagnostic also splits the residual into controller-responsibility groups (normalization, business rules, ticket pricing, Redis key/argument construction, post-hold preparation, logging, and response construction/dispatch). It records wall-clock samples and benchmark-only synchronous CPU samples; process-wide event-loop delay remains a diagnostic indicator rather than per-request attribution.
- `seat-contention.js`: 100 VUs compete for 5 seats by default (`CONTESTED_SEATS`). A `409` is an expected business conflict, not an infrastructure failure.
- `flash-sale.js`: 300 VUs join before the seeded sale time, then poll admission at opening. Seed with enough lead time to let k6 start. Metrics: queue/admission latency and failed iterations.
- `mixed-lifecycle.js`: one third payment callback, one third release, one third abandonment. It needs the test gateway HMAC secret only for the provider-callback leg:

```powershell
$env:MOCK_PAYMENT_SECRET = '<the local payment webhook secret>'
k6 run --summary-export perf/results/mixed-lifecycle.json perf/mixed-lifecycle.js
```

- `soak.js`: 25 VUs for 30 minutes by default; holds then releases deterministic seats. Run only after the short scenarios.

```powershell
k6 run --summary-export perf/results/soak.json perf/soak.js
```

The direct signed callback in the mixed test is labelled **provider-callback benchmark**: it measures Tickify's normal webhook processing but not a real payment-provider network round trip. Payment URL creation remains part of that flow.

## Diagnostics and correctness gate

While a run is active, collect lightweight, opt-in process/dependency diagnostics:

```powershell
Invoke-RestMethod "$env:BASE_URL/performance/diagnostics" | ConvertTo-Json -Depth 8 | Set-Content perf/results/diagnostics.json
npm run perf:verify -- --manifest perf/generated/baseline-001.json
```

Diagnostics include request latency/counts/errors, process CPU/memory/event-loop delay, Redis ping/stats, Mongo command latency and transaction counters, BullMQ delayed-expiration lag, and unpublished outbox age. They are disabled unless `PERFORMANCE_DIAGNOSTICS_ENABLED=true`.

The verification gate checks active owner uniqueness, confirmed Mongo/Redis convergence, lock absence for terminal reservations, ticket cardinality, and stale active Redis state after cancellation. Its JSON report is saved under `perf/results/`. Run it after each booking-focused scenario; a nonzero exit means the benchmark result is not valid.

SSE is intentionally not in the booking transaction scenarios. To benchmark it separately, connect clients to `GET /shows/:showId/stream` and report connection count, time-to-first event, reconnect rate, and event delivery delay; this route is a distinct long-lived-connection workload.
