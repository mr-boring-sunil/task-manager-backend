# Inter-Engine Communication & Interaction Logging

## 1. Core Principles

The Raspberry Pi Task Manager backend integrates three engines inside a **single Node.js runtime process**.

1. **Direct In-Memory JavaScript Function Calls**: All inter-engine calls execute directly in memory via JavaScript class methods. No internal HTTP, WebSockets, IPC sockets, or message queues are used between engines.
2. **Decoupled Engine Interfaces**: Engines do not import each other's internal private classes directly. Communication flows through public interface objects:
   - `SchedulingEngineInterface` (`engines/scheduling-engine/interface/scheduling.interface.js`)
   - `DatabaseSecurityEngineInterface` (`engines/database-security-engine/interface/security.interface.js`)
3. **CEE Adapters as Ingress Gateways**: In CEE, all external calls pass through:
   - `schedulingAdapter` (`engines/communication-execution-engine/adapters/scheduling.adapter.js`)
   - `securityAdapter` (`engines/communication-execution-engine/adapters/security.adapter.js`)
4. **Mandatory Interaction Logging**: Every single cross-engine call is recorded with start, completion, duration, and error logs using `interactionLogger`.

---

## 2. Interaction Logging Protocol & Format

All interactions strictly adhere to the specification defined in Section 8 of the Master Specification.

### Log Shapes

#### Outgoing Request
```text
[<ISO 8601 Timestamp>]
[<Source Engine> -> <Destination Engine>]
[REQUEST]
Operation: <Operation Name>
Request ID: <Correlation ID>
Status: Started
```

#### Successful Response
```text
[<ISO 8601 Timestamp>]
[<Destination Engine> -> <Source Engine>]
[RESPONSE]
Operation: <Operation Name>
Request ID: <Correlation ID>
Status: Success
Duration: <Elapsed Time>ms
```

#### Error Response
```text
[<ISO 8601 Timestamp>]
[<Destination Engine> -> <Source Engine>]
[ERROR]
Operation: <Operation Name>
Request ID: <Correlation ID>
Error: <Error Code or Message>
Duration: <Elapsed Time>ms
```

### Real Example: Process Creation Workflow

```text
[2026-11-15T13:04:18.470Z]
[CEE -> DSE]
[REQUEST]
Operation: authorizeAction
Request ID: proc_create_kj8d9s2a
Status: Started

[2026-11-15T13:04:18.472Z]
[DSE -> CEE]
[RESPONSE]
Operation: authorizeAction
Request ID: proc_create_kj8d9s2a
Status: Success
Duration: 2ms

[2026-11-15T13:04:18.473Z]
[CEE -> SE]
[REQUEST]
Operation: createProcess
Request ID: proc_create_kj8d9s2a
Status: Started

[2026-11-15T13:04:18.495Z]
[SE -> CEE]
[RESPONSE]
Operation: createProcess
Request ID: proc_create_kj8d9s2a
Status: Success
Duration: 22ms

[2026-11-15T13:04:18.496Z]
[CEE -> DSE]
[REQUEST]
Operation: recordAuditEvent
Request ID: proc_create_kj8d9s2a
Status: Started

[2026-11-15T13:04:18.515Z]
[DSE -> CEE]
[RESPONSE]
Operation: recordAuditEvent
Request ID: proc_create_kj8d9s2a
Status: Success
Duration: 19ms
```

---

## 3. Communication Patterns

### A. Process Listing: CEE -> SE
- **Caller**: `ProcessOrchestrator.listProcesses(options)`
- **Adapter**: `schedulingAdapter.listProcesses(options, requestId)`
- **SE Interface**: `seInterface.listProcesses(options)`
- **Return Type**:
  ```json
  {
    "processes": [
      {
        "pid": 1001,
        "ppid": 1,
        "name": "node",
        "command": "/usr/bin/node server.js",
        "username": "pi",
        "cpu": 1.2,
        "memory": 2.4,
        "memoryRss": 45612032,
        "state": "running",
        "started": "2026-11-15 12:00:00"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 128, "totalPages": 7 }
  }
  ```

### B. Process Termination: CEE -> DSE -> SE -> DSE
- **Step 1**: CEE requests authorization:
  `securityAdapter.authorizeAction(user, 'process:terminate', { pid }, reqId)`
  - DSE checks role permissions and verifies that `pid` is not in `PROTECTED_PIDS`.
- **Step 2**: If authorized, CEE commands SE:
  `schedulingAdapter.terminateProcess(pid, { signal: 'SIGTERM', graceful: true }, reqId)`
  - SE attempts graceful `SIGTERM` and escalates to `SIGKILL` if process resists.
- **Step 3**: CEE records the audit event:
  `securityAdapter.recordAuditEvent({ user, action: 'process:terminate', resource: pid, ... }, reqId)`
  - DSE redacts any sensitive tokens and persists the record to SQLite.

### C. Process Priority Adjustment: CEE -> DSE -> SE -> DSE
- **Step 1**: CEE requests authorization:
  `securityAdapter.authorizeAction(user, 'process:priority', { pid, priority }, reqId)`
- **Step 2**: CEE commands priority change:
  `schedulingAdapter.changePriority(pid, priority, reqId)`
  - SE validates priority is between `-20` and `19` and executes `renice`.
- **Step 3**: CEE records the audit event in DSE.

### D. System Telemetry Gathering: CEE -> SE
- **Caller**: `MetricsService.getOverview()` / `MetricsService.getCpuMetrics()` / `MetricsService.getTemperatureMetrics()`
- **Adapter**: `schedulingAdapter.getSystemMetrics(reqId)`
- **SE Interface**: Aggregates from `collectors/` (`cpu.collector.js`, `thermal.collector.js`, etc.).
- **Missing Sensor Rule**: Missing temperature sensor data is explicitly returned as `null` / `available: false`, never fabricated.

---

## 4. Error Propagation & Hierarchy

All engines share the unified `AppError` hierarchy in `shared/errors/AppError.js`:

```
              AppError (Base class)
             /        \
 ValidationError     NotFoundError
        |                   |
 ForbiddenError      UnauthorizedError
        |                   |
  ConflictError       DatabaseError
```

- When an engine encounters an operational failure, it throws a typed `AppError` subclass populated with an `errorCode` and HTTP status code.
- `interactionLogger.execute()` catches the exception, outputs the `[ERROR]` log entry with the duration, and rethrows the error unchanged.
- Express's centralized `error.middleware.js` catches the error and formats the response:
  ```json
  {
    "success": false,
    "error": {
      "code": "PROTECTED_PROCESS",
      "message": "Operation 'process:terminate' forbidden on protected system process (PID: 1)",
      "details": { "pid": 1 }
    },
    "meta": {
      "timestamp": "2026-11-15T13:04:18.500Z",
      "requestId": "proc_term_98x1az"
    }
  }
  ```
