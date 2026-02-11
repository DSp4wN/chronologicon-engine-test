# Conceptual Knowledge & Formulas - Chronologicon Engine

A deep dive into every concept, algorithm, data structure, and formula used to solve the Chronologicon Engine problem.

---

## Table of Contents

1. [Database Design Concepts](#1-database-design-concepts)
2. [File Ingestion & Stream Processing](#2-file-ingestion--stream-processing)
3. [Asynchronous Job Processing](#3-asynchronous-job-processing)
4. [Hierarchical Timeline Reconstruction (Recursive CTE)](#4-hierarchical-timeline-reconstruction-recursive-cte)
5. [Search with Pagination & Sorting](#5-search-with-pagination--sorting)
6. [Overlapping Events Detection (Self-Join)](#6-overlapping-events-detection-self-join)
7. [Temporal Gap Finder (Sweep Line Algorithm)](#7-temporal-gap-finder-sweep-line-algorithm)
8. [Event Influence Spreader (Dijkstra's Algorithm)](#8-event-influence-spreader-dijkstras-algorithm)
9. [Input Validation & Security](#9-input-validation--security)
10. [Complexity Summary](#10-complexity-summary)

---

## 1. Database Design Concepts

### 1.1 UUID as Primary Key

A **UUID (Universally Unique Identifier)** is a 128-bit identifier, typically displayed as:

```
a1b2c3d4-e5f6-7890-1234-567890abcdef
   8       4    4    4       12          (hex digits per group)
```

**Why UUID over auto-increment?**

| Feature | Auto-Increment | UUID |
|---------|---------------|------|
| Uniqueness scope | Single database | Globally unique |
| ID predictability | Sequential (security risk) | Random |
| Distributed systems | Conflicts on merge | No conflicts |
| Pre-generation | Requires DB call | Generate client-side |

**UUID v4 formula:** 122 random bits + 6 version/variant bits = \(2^{122}\) ≈ \(5.3 \times 10^{36}\) possible values.

The probability of collision after generating \(n\) UUIDs is approximately:

\[
P(\text{collision}) \approx 1 - e^{-\frac{n^2}{2 \times 2^{122}}}
\]

Even at 1 billion UUIDs per second for 100 years, the collision probability is ~ \(10^{-18}\).

### 1.2 TIMESTAMPTZ (Timestamp with Time Zone)

PostgreSQL stores `TIMESTAMPTZ` internally as **microseconds since 2000-01-01 00:00:00 UTC** (8 bytes).

All inputs are converted to UTC for storage, making comparisons timezone-safe:

```
Input:  2023-01-01T10:00:00+05:30
Stored: 2023-01-01T04:30:00.000000 UTC
```

**Why TIMESTAMPTZ over TIMESTAMP?**
- `TIMESTAMP` stores literal time - no timezone awareness; breaks with global data.
- `TIMESTAMPTZ` normalizes to UTC - always comparable, always correct.

### 1.3 Generated Column (duration_minutes)

A **generated column** is computed from other columns and stored physically on disk.

**Formula:**

\[
\text{duration\_minutes} = \left\lfloor \frac{\text{end\_date} - \text{start\_date}}{\text{60 seconds}} \right\rfloor
\]

In PostgreSQL:

```sql
duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_date - start_date))::INTEGER / 60
) STORED
```

- `EXTRACT(EPOCH FROM interval)` converts a time interval to total seconds.
- `::INTEGER / 60` converts seconds to whole minutes.
- `STORED` means the value is computed once on INSERT/UPDATE and stored on disk.

**Trade-off:**

| Approach | Read Cost | Write Cost | Consistency |
|----------|----------|------------|-------------|
| Application-calculated | O(1) | O(1) | Risk of mismatch |
| `GENERATED ALWAYS` | O(1) | O(1) + small overhead | Guaranteed by DB |
| Computed at query time | O(n) per query | None | Always correct |

The generated column gives **O(1) reads** with **guaranteed consistency**.

### 1.4 Self-Referential Foreign Key (parent_event_id)

The `parent_event_id` column references the same table's `event_id`, creating a **tree structure** (also called an **adjacency list**):

```
historical_events
├── event_id (PK)          ◄── referenced by
└── parent_event_id (FK)   ───► event_id (same table)
```

**Visual example:**

```
Founding (NULL parent)
├── Phase 1 Research (parent = Founding)
│   └── Internal Review Meeting (parent = Phase 1)
├── Analysis Phase Alpha (parent = Founding)
│   ├── Data Cataloging (parent = Analysis)
│   └── Pattern Recognition (parent = Analysis)
└── Temporal Alignment Test (parent = Founding)
    └── Algorithm Calibration (parent = Temporal)
```

**ON DELETE SET NULL:** If a parent event is deleted, children become root events (orphan prevention).

### 1.5 JSONB (Binary JSON)

**JSONB** stores JSON in a decomposed binary format.

| Feature | JSON | JSONB |
|---------|------|-------|
| Storage | Text (exact copy) | Parsed binary tree |
| Duplicate keys | Preserved | Last value wins |
| Key ordering | Preserved | Not preserved |
| Indexing | Not supported | GIN / GiST indexes |
| Read speed | Requires parsing | Direct access |
| Write speed | Faster (no parsing) | Slower (must parse) |

Used for `metadata` to store flexible, unstructured data (source file, line number, flags) without schema changes.

### 1.6 Indexing Strategy

**B-Tree Indexes** (default) - for equality and range queries:

```sql
CREATE INDEX idx_events_start_date ON historical_events(start_date);
CREATE INDEX idx_events_end_date ON historical_events(end_date);
CREATE INDEX idx_events_parent_id ON historical_events(parent_event_id);
CREATE INDEX idx_events_date_range ON historical_events(start_date, end_date);
```

**Composite Index** `(start_date, end_date)` - satisfies queries that filter on both columns without needing two separate index lookups.

**GIN Trigram Index** - for case-insensitive partial text search (`ILIKE '%term%'`):

```sql
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE INDEX idx_events_name_trgm ON historical_events USING GIN (event_name gin_trgm_ops);
```

**How trigram matching works:**

The string `"Phase"` is decomposed into trigrams:

```
"Phase" → {"  p", " ph", "pha", "has", "ase", "se "}
```

A GIN index stores a mapping from each trigram to the rows that contain it. When searching `ILIKE '%pha%'`, PostgreSQL looks up trigrams `{"pha"}` in the index, finding matching rows in **O(1)** instead of scanning every row.

**Index Lookup Complexity:**

| Index Type | Lookup | Range Scan | Pattern Match |
|-----------|--------|------------|---------------|
| B-Tree | O(log n) | O(log n + k) | Prefix only |
| GIN Trigram | O(1) amortized | N/A | Any substring |

Where \(n\) = total rows, \(k\) = matching rows.

---

## 2. File Ingestion & Stream Processing

### 2.1 The Problem

A historical data file can contain millions of lines. Loading the entire file into memory would be:

\[
\text{Memory} = \text{lines} \times \text{avg bytes per line}
\]

For 10M lines × 200 bytes = **2 GB** - unacceptable.

### 2.2 Stream-Based Solution

Node.js streams process data in **chunks** without loading the entire file:

```
File on Disk ──► ReadStream ──► readline interface ──► Process line-by-line
                  (64KB chunks)    (splits on \n)       (O(1) memory per line)
```

**Key APIs:**
- `fs.createReadStream()` - reads the file in 64KB chunks (configurable).
- `readline.createInterface()` - splits the byte stream on newline boundaries.
- `for await (const line of rl)` - async iterator, processes one line at a time.

**Memory complexity:** O(1) - only one line + one batch in memory at any time.

### 2.3 Batch Inserts

Instead of inserting each event individually (N database round trips), events are batched:

```
Individual:  N events × 1 INSERT = N round trips
Batched:     N events ÷ 500/batch = N/500 round trips
```

**Speedup factor:** ~500× fewer network round trips.

**Formula for total DB calls:**

\[
\text{DB calls} = \left\lceil \frac{N}{\text{BATCH\_SIZE}} \right\rceil
\]

With `BATCH_SIZE = 500` and 10,000 events: \(\lceil 10000 / 500 \rceil = 20\) DB calls instead of 10,000.

### 2.4 Line Parsing & Validation

Each line is parsed as a pipe-delimited string with exactly 6 fields:

```
EVENT_ID | EVENT_NAME | START_DATE | END_DATE | PARENT_ID_OR_NULL | DESCRIPTION
   [0]        [1]         [2]         [3]           [4]               [5]
```

**Validation rules (in order):**

1. **Field count:** Must be exactly 6 (split by `|`)
2. **event_id:** Must match UUID regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
3. **event_name:** Must be non-empty
4. **start_date:** Must be valid ISO 8601 with `T` separator
5. **end_date:** Must be valid ISO 8601 with `T` separator
6. **Date ordering:** `end_date >= start_date`
7. **parent_event_id:** Must be `NULL` or a valid UUID

If any validation fails, the line is logged as an error and skipped - **processing continues** for remaining lines.

---

## 3. Asynchronous Job Processing

### 3.1 The Pattern

File ingestion is a **long-running operation**. The API uses the **async job pattern**:

```
Client                    Server                    Background Worker
  │                         │                              │
  ├── POST /ingest ────────►│                              │
  │                         ├── Create Job (PENDING) ─────►│
  │◄── 202 { jobId } ──────┤                              │
  │                         │     ┌── Process file ────────┤
  │                         │     │   Line by line...      │
  ├── GET /status/jobId ───►│     │                        │
  │◄── { PROCESSING, 50% } ┤     │                        │
  │                         │     │   Update job store     │
  ├── GET /status/jobId ───►│     │                        │
  │◄── { COMPLETED, 100% } ┤◄────┘                        │
```

**HTTP 202 Accepted** means: "I received your request and will process it, but it's not done yet."

### 3.2 Job State Machine

```
PENDING ──► PROCESSING ──► COMPLETED
                  │
                  └──────► FAILED
```

The in-memory job store tracks: `jobId`, `status`, `processedLines`, `errorLines`, `totalLines`, `errors[]`, `startTime`, `endTime`.

---

## 4. Hierarchical Timeline Reconstruction (Recursive CTE)

### 4.1 The Problem

Events form a **tree** (parent-child relationships). Given any event, we need to reconstruct the entire tree as nested JSON.

### 4.2 Recursive CTE (Common Table Expression)

A **recursive CTE** is a SQL query that references itself, enabling tree traversal in a single query.

**Structure:**

```sql
WITH RECURSIVE cte_name AS (
    -- Base case: the starting row(s)
    SELECT * FROM table WHERE condition

    UNION ALL

    -- Recursive step: join back to find related rows
    SELECT t.*
    FROM table t
    INNER JOIN cte_name c ON t.parent_id = c.id
)
SELECT * FROM cte_name;
```

**Execution model (downward traversal):**

```
Iteration 0: SELECT root event (event_id = ?)
              Result: { Founding }

Iteration 1: JOIN where parent_event_id = Founding.event_id
              Result: { Phase 1, Analysis, Temporal Alignment }

Iteration 2: JOIN where parent_event_id IN (Phase 1, Analysis, Temporal)
              Result: { Internal Review, Data Cataloging, Pattern Recognition, Algorithm Calibration }

Iteration 3: JOIN where parent_event_id IN (...)
              Result: {} (empty → recursion stops)
```

**Upward traversal** (ancestor chain) reverses the join:

```sql
INNER JOIN ancestor_tree a ON e.event_id = a.parent_event_id
```

### 4.3 Tree Construction in Application Code

The flat array from the CTE is converted to a nested structure using a **hash map approach**:

```
Step 1: Create Map<event_id → event_with_children[]>
Step 2: For each event, if it has a parent, push it into parent.children
Step 3: Return the root node
```

**Complexity:**
- Time: O(n) - single pass to build map + single pass to wire children
- Space: O(n) - map of all events

### 4.4 Adjacency List vs. Other Tree Storage Models

| Model | Storage | Read (subtree) | Write | Move Node |
|-------|---------|----------------|-------|-----------|
| **Adjacency List** (our choice) | parent_id FK | Recursive CTE: O(n) | O(1) | O(1) |
| Nested Sets | lft/rgt integers | Single range query: O(log n) | O(n) rebuild | O(n) |
| Materialized Path | path string `"/1/3/7"` | LIKE prefix: O(n) | O(1) | O(subtree size) |
| Closure Table | ancestor/descendant pairs | Join: O(n) | O(depth) | O(subtree × depth) |

**Adjacency List** was chosen because:
- Simplest schema (single FK column)
- PostgreSQL recursive CTEs make reads efficient
- O(1) writes and moves (only update one row)

---

## 5. Search with Pagination & Sorting

### 5.1 Offset-Based Pagination

**Formula:**

\[
\text{offset} = (\text{page} - 1) \times \text{limit}
\]

```sql
SELECT * FROM historical_events
ORDER BY start_date ASC
LIMIT 10 OFFSET 20;     -- Page 3, 10 results per page
```

**Visualization:**

```
All rows:  [0, 1, 2, ... 19, 20, 21, ... 29, 30, 31, ...]
                              ▲                ▲
Page 1: offset=0,  limit=10   │  Page 3         │  Page 4
Page 2: offset=10, limit=10   │  offset=20      │  offset=30
```

**Trade-off:** Offset pagination becomes slow for large offsets because the database must scan and discard `offset` rows. For very large datasets, cursor-based pagination is preferred.

### 5.2 Case-Insensitive Partial Matching (ILIKE)

```sql
WHERE event_name ILIKE '%search_term%'
```

- `ILIKE` = case-**i**nsensitive `LIKE`
- `%term%` = match anywhere in the string (prefix + suffix wildcards)
- Accelerated by the **GIN trigram index** (avoids sequential scan)

### 5.3 SQL Injection Prevention (Sort Column Whitelist)

User-provided `sortBy` is never interpolated directly into SQL. Instead:

```javascript
const allowedSortColumns = ['start_date', 'end_date', 'event_name', 'duration_minutes'];
const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'start_date';
```

This is a **whitelist approach** - only pre-approved column names can be used in `ORDER BY`.

---

## 6. Overlapping Events Detection (Self-Join)

### 6.1 Interval Overlap Condition

Two time intervals \([s_A, e_A]\) and \([s_B, e_B]\) overlap if and only if:

\[
s_A < e_B \quad \text{AND} \quad s_B < e_A
\]

**Visual proof:**

```
Case 1: Overlap
  A: |████████████|
  B:       |████████████|
     sA    sB     eA    eB
     sA < eB ✓  AND  sB < eA ✓  → OVERLAP

Case 2: No overlap
  A: |████████|
  B:              |████████|
     sA      eA   sB      eB
     sA < eB ✓  AND  sB < eA ✗  → NO OVERLAP

Case 3: Adjacent (touching, not overlapping)
  A: |████████|
  B:          |████████|
     sA      eA=sB    eB
     sA < eB ✓  AND  sB < eA ✗  → NO OVERLAP (strict inequality)
```

### 6.2 Overlap Duration Formula

\[
\text{overlap\_duration} = \min(e_A, e_B) - \max(s_A, s_B)
\]

In SQL:

```sql
EXTRACT(EPOCH FROM (LEAST(a.end_date, b.end_date) - GREATEST(a.start_date, b.start_date))) / 60
```

### 6.3 Self-Join for Distinct Pairs

To find all overlapping pairs without duplicates, the table is joined with itself:

```sql
FROM historical_events a
JOIN historical_events b ON a.event_id < b.event_id
WHERE a.start_date < b.end_date
  AND b.start_date < a.end_date
```

**Why `a.event_id < b.event_id`?**

Without this condition, we'd get:
- (A, B) **and** (B, A) - duplicate pair
- (A, A) - self-pair (meaningless)

The `<` condition ensures each pair appears exactly once and eliminates self-joins.

**Complexity:** O(n²) in the worst case (every event overlaps every other). The `WHERE` clause with indexed date columns prunes most comparisons.

---

## 7. Temporal Gap Finder (Sweep Line Algorithm)

### 7.1 The Problem

Given a time range \([S, E]\) and a set of events within it, find the **largest continuous period** where no events are recorded.

### 7.2 The Sweep Line Algorithm

This is a classic **computational geometry** technique adapted for 1D intervals.

**Concept:** Imagine a vertical line sweeping left to right across the timeline. We track the **frontier** - the furthest point in time that is "covered" by any event seen so far.

**Algorithm:**

```
1. Sort events by start_date (ascending)
2. Set frontier = startDate (beginning of query range)
3. For each event:
   a. If event.start_date > frontier:
      → GAP FOUND: from frontier to event.start_date
      → gap_duration = event.start_date - frontier
      → Track if this is the largest gap
   b. Update frontier = max(frontier, event.end_date)
4. Check trailing gap: if endDate > frontier
   → GAP FOUND: from frontier to endDate
```

**Visual walkthrough:**

```
Query range: [Jan 1  ──────────────────────────────────  Jan 20]

Events:       [███ A ███]        [███ B ███]    [██ C ██]
              Jan 2-4            Jan 10-12      Jan 15-17

Sweep:
  frontier = Jan 1
  
  Event A (start=Jan 2):
    Jan 2 > Jan 1 → GAP: Jan 1 to Jan 2 (1 day)
    frontier = max(Jan 1, Jan 4) = Jan 4

  Event B (start=Jan 10):
    Jan 10 > Jan 4 → GAP: Jan 4 to Jan 10 (6 days) ← LARGEST
    frontier = max(Jan 4, Jan 12) = Jan 12

  Event C (start=Jan 15):
    Jan 15 > Jan 12 → GAP: Jan 12 to Jan 15 (3 days)
    frontier = max(Jan 12, Jan 17) = Jan 17

  Trailing check:
    Jan 20 > Jan 17 → GAP: Jan 17 to Jan 20 (3 days)

  Result: Largest gap = Jan 4 to Jan 10 (6 days = 8640 minutes)
```

### 7.3 Handling Overlapping Events

The frontier tracks the **maximum coverage** seen so far. Overlapping events extend the frontier without creating false gaps:

```
  A: |████████████████|
  B:       |████████████████|
           ↑                ↑
     frontier doesn't retreat; B extends it further

  frontier after A = end_A
  frontier after B = max(end_A, end_B) = end_B  (B extends coverage)
  → No gap between A and B (correct!)
```

### 7.4 Gap Duration Formula

\[
\text{gap\_duration\_minutes} = \left\lfloor \frac{\text{gap\_end} - \text{gap\_start}}{60000} \right\rfloor
\]

Where dates are in milliseconds (JavaScript `Date` objects).

### 7.5 Complexity

| Step | Cost |
|------|------|
| Sort by start_date | O(n log n) - done by PostgreSQL via index |
| Sweep through events | O(n) - single pass |
| **Total** | **O(n)** (sorting is done in DB with index) |
| Space | O(1) - only frontier + current largest gap |

---

## 8. Event Influence Spreader (Dijkstra's Algorithm)

### 8.1 The Problem

Given a **source event** and a **target event**, find the path through the parent-child hierarchy with the **minimum total duration** (sum of `duration_minutes` along the path).

This is a **weighted shortest path problem** on a graph.

### 8.2 Modeling as a Graph

Each event is a **node**. Each parent-child relationship creates a **bidirectional edge** (influence can flow both up and down the hierarchy).

```
Nodes:  {A, B, C, D, E}
Edges:  A ↔ B (A is parent of B)
        A ↔ C (A is parent of C)
        B ↔ D (B is parent of D)
        C ↔ E (C is parent of E)

Weights: Each node has weight = its own duration_minutes
```

**Adjacency list representation:**

```
A: [B, C]
B: [A, D]
C: [A, E]
D: [B]
E: [C]
```

### 8.3 Dijkstra's Algorithm

Dijkstra's algorithm finds the shortest path from a source to all other nodes in a weighted graph with **non-negative weights**.

**Why Dijkstra's?**
- All `duration_minutes` values are ≥ 0 (non-negative weights ✓)
- We need the optimal (minimum cost) path, not just any path
- BFS only works for unweighted graphs

**Algorithm (pseudocode):**

```
function dijkstra(source, target, graph):
    dist = {}          // shortest known distance to each node
    prev = {}          // previous node on shortest path
    visited = Set()
    pq = MinHeap()     // priority queue ordered by cost

    dist[source] = weight(source)
    pq.push({cost: weight(source), node: source})

    while pq is not empty:
        {cost, node} = pq.pop()       // extract minimum cost node

        if node == target:
            return reconstruct_path(prev, target)

        if node in visited:
            continue
        visited.add(node)

        for each neighbor of node:
            if neighbor not in visited:
                newCost = cost + weight(neighbor)
                if newCost < dist[neighbor]:
                    dist[neighbor] = newCost
                    prev[neighbor] = node
                    pq.push({cost: newCost, node: neighbor})

    return "No path found"
```

### 8.4 Step-by-Step Example

```
Graph: A(60) → B(480) → C(960) → D(180)

Find shortest path from A to D.

Step 1: Initialize
  dist = { A: 60 }
  pq = [{cost:60, node:A}]

Step 2: Pop A (cost=60)
  Visit A. Neighbors: [B]
  newCost(B) = 60 + 480 = 540
  dist = { A:60, B:540 }
  pq = [{cost:540, node:B}]

Step 3: Pop B (cost=540)
  Visit B. Neighbors: [A, C]
  A already visited, skip.
  newCost(C) = 540 + 960 = 1500
  dist = { A:60, B:540, C:1500 }
  pq = [{cost:1500, node:C}]

Step 4: Pop C (cost=1500)
  Visit C. Neighbors: [B, D]
  B already visited, skip.
  newCost(D) = 1500 + 180 = 1680
  dist = { A:60, B:540, C:1500, D:1680 }
  pq = [{cost:1680, node:D}]

Step 5: Pop D (cost=1680)
  D == target → FOUND!
  Reconstruct: D ← C ← B ← A
  Path: [A(60), B(480), C(960), D(180)]
  Total: 1680 minutes
```

### 8.5 Binary Min-Heap (Priority Queue)

Dijkstra's algorithm requires efficiently extracting the node with the **minimum cost**. A **binary min-heap** provides this:

```
         10
        /  \
      15    20
     / \   /
    30  25 35
```

**Heap property:** Every parent ≤ its children.

**Operations:**

| Operation | Description | Complexity |
|-----------|-------------|------------|
| `push(item)` | Insert and bubble up | O(log n) |
| `pop()` | Remove min, replace with last, sink down | O(log n) |
| `peek()` | Read minimum without removing | O(1) |

**Bubble Up (after insert):**

```
Insert 5:
         10               10               5
        /  \     →       /  \     →       /  \
      15    20         5    20          10    20
     / \   / \        / \  / \         / \   / \
    30 25 35  [5]    30 25 35 15      30 25 35 15
                     (swap with 15)   (swap with 10)
```

**Sink Down (after pop):**

```
Pop min (5), move last to root:
         [15]              10
         /  \     →       /  \
       10    20         15    20
      / \   /          / \   /
     30 25 35         30 25 35
     (swap with 10)
```

### 8.6 Path Reconstruction

After Dijkstra's finds the target, the path is reconstructed by following the `prev` map backward:

```
prev = { B: A, C: B, D: C }

Reconstruct from D:
  D → prev[D] = C → prev[C] = B → prev[B] = A → prev[A] = undefined (stop)

Reverse: [A, B, C, D]
```

### 8.7 Complexity

| Aspect | Cost |
|--------|------|
| Build adjacency list | O(V + E) |
| Dijkstra with binary heap | O((V + E) × log V) |
| Path reconstruction | O(V) |
| **Total** | **O((V + E) × log V)** |
| Space | O(V + E) for graph + O(V) for dist/prev |

Where V = number of events, E = number of parent-child edges.

For a tree (which this is), E = V - 1, so:

\[
O((V + V - 1) \times \log V) = O(V \log V)
\]

### 8.8 Why Not BFS?

| Algorithm | Edge Weights | Finds Shortest Path? | Complexity |
|-----------|-------------|---------------------|------------|
| **BFS** | Unweighted only | Yes (fewest hops) | O(V + E) |
| **Dijkstra** | Non-negative weights | Yes (minimum cost) | O((V+E) log V) |
| **Bellman-Ford** | Any (including negative) | Yes | O(V × E) |

Since events have different durations (weights), **BFS would find the path with fewest hops, not the minimum total duration**. Dijkstra's correctly minimizes cumulative weight.

**Example where BFS fails:**

```
A(10) ──► B(1000) ──► D(10)    BFS path: A→B→D (2 hops, cost=1020)
A(10) ──► C(5)    ──► D(10)    Dijkstra: A→C→D (2 hops, cost=25) ✓
```

Both paths have 2 hops, but Dijkstra picks the cheaper one.

---

## 9. Input Validation & Security

### 9.1 Joi Schema Validation

**Joi** provides declarative validation at the API boundary:

```
Request → Joi Validation → Controller → Service → Model → Database
           ▲
           │ Rejects invalid input with 400 error
           │ BEFORE any business logic runs
```

**Validation types used:**

| Joi Method | Purpose | Example |
|-----------|---------|---------|
| `.string().uuid()` | Validates UUID format | `sourceEventId` |
| `.string().isoDate()` | Validates ISO 8601 date | `startDate` |
| `.number().integer().min(1)` | Validates positive integer | `page` |
| `.string().valid(...)` | Whitelist of allowed values | `sortOrder: 'asc' \| 'desc'` |
| `.required()` | Field must be present | `startDate` in temporal-gaps |
| `.optional()` | Field can be omitted | `name` in search |

### 9.2 SQL Injection Prevention

**Parameterized queries** via Knex ensure user input is never interpolated into SQL:

```javascript
// UNSAFE (string concatenation):
db.raw(`SELECT * FROM events WHERE name = '${userInput}'`);  // ← SQL INJECTION

// SAFE (parameterized):
db.raw(`SELECT * FROM events WHERE name = ?`, [userInput]);  // ← Escaped by driver
```

Knex's query builder methods (`.where()`, `.insert()`, etc.) automatically parameterize all values.

---

## 10. Complexity Summary

| Operation | Time Complexity | Space Complexity | Implementation |
|-----------|----------------|-----------------|----------------|
| **File ingestion** | O(n) | O(B) where B = batch size | Stream + batch insert |
| **Line parsing** | O(1) per line | O(1) | Regex + string split |
| **Timeline (CTE)** | O(n) | O(n) | Recursive CTE + hash map |
| **Search** | O(log n + k) | O(k) | B-Tree index + LIMIT/OFFSET |
| **Overlapping events** | O(n²) worst case | O(p) where p = pairs | Self-join with index |
| **Temporal gaps** | O(n) | O(1) | Sweep line |
| **Event influence** | O(V log V) | O(V + E) | Dijkstra + MinHeap |
| **UUID validation** | O(1) | O(1) | Regex match |
| **Batch insert** | O(n/B) DB calls | O(B) | Knex `.insert()` |

Where:
- n = number of events
- k = number of results returned
- p = number of overlapping pairs
- V = vertices (events), E = edges (parent-child relationships)
- B = batch size (500)

