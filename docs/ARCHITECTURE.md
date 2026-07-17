# Mend architecture

Three lanes: ACT (find and patch), VERIFY (four gates plus critic), PROVE
(receipts, dashboard, deploy). The fixer never grades its own homework and the
gates cannot be argued with.

## 1. System overview

```mermaid
flowchart LR
    subgraph RUN["Loop runner (loop.sh → Claude Code, Bedrock)"]
        direction TB
        T[TASKS.md + JOURNAL.md<br/>state in git]
    end

    subgraph ACT["ACT"]
        direction TB
        S[axe-core scan<br/>Playwright] --> M[Source mapper<br/>DOM node → file:line]
        M --> F[Fixer agent<br/>Claude on Bedrock<br/>patches SOURCE only]
    end

    subgraph TGT["Patient"]
        P[Target site<br/>behind Pomerium policy<br/>agent holds no credentials]
    end

    subgraph VERIFY["VERIFY — all gates must pass"]
        direction TB
        G1[Gate 1<br/>axe re-scan:<br/>violation gone] --> G2[Gate 2<br/>pixel diff vs baseline<br/>masked + frozen]
        G2 --> G3[Gate 3<br/>banned-pattern check<br/>no suppression]
        G3 --> G4[Gate 4<br/>IBM Equal Access<br/>independent engine]
        G4 --> C[Critic agent<br/>isolated context<br/>judges alt text truth,<br/>label meaning]
    end

    subgraph PROVE["PROVE"]
        direction TB
        R[Receipt per fix<br/>before/after + diffs + verdicts]
        D[Live dashboard<br/>WebSocket counter + gate lights]
        Z[Zero deploy<br/>agent ships healed site<br/>to shareable link]
    end

    RUN --> S
    S -->|renders| P
    F -->|rebuild| P
    F --> G1
    C -->|PASS| R
    C -->|FAIL| REV[Auto-revert<br/>+ failure receipt]
    REV --> R
    R --> D
    R --> Z
```

## 2. One round, as a sequence

```mermaid
sequenceDiagram
    autonumber
    participant L as Loop runner
    participant X as axe (Playwright)
    participant MP as Source mapper
    participant FX as Fixer (Bedrock)
    participant GT as Gates 1–4
    participant CR as Critic (isolated)
    participant RC as Receipts + dashboard

    L->>X: scan target
    X-->>L: violations.json (rule, selector, snippet)
    L->>MP: map top violation to source
    MP-->>L: file:line (or BLOCKED after 2 tries)
    L->>FX: patch this violation, source only
    FX-->>L: small diff + rebuild
    L->>GT: npm run verify
    alt any gate fails
        GT-->>L: FAIL (which gate, why)
        L->>RC: revert commit + FAILURE receipt
        Note over RC: caught failure = evidence<br/>the harness works
    else gates pass
        GT-->>L: PASS
        L->>CR: judge semantic quality (sees the image/context)
        alt critic FAIL
            CR-->>L: FAIL + reason
            L->>RC: revert + failure receipt
        else critic PASS
            CR-->>L: PASS
            L->>RC: accept commit + receipt
        end
    end
    RC-->>L: dashboard updated, next round
```

## 3. Gate logic (including the contrast special case)

```mermaid
flowchart TD
    A[Patched build] --> B{Gate 1: axe re-scan<br/>target violation gone,<br/>none introduced?}
    B -- no --> RV[REVERT + failure receipt]
    B -- yes --> C{Contrast-class fix?}
    C -- no --> D{Gate 2: pixel diff = 0<br/>outside masks?}
    C -- yes --> D2{Gate 2b: flagged element masked,<br/>all other bounding boxes stable,<br/>new ratio ≥ 4.5:1?}
    D -- no --> RV
    D2 -- no --> RV
    D -- yes --> E
    D2 -- yes --> E{Gate 3: banned patterns<br/>in diff?}
    E -- found --> RV
    E -- clean --> F{Gate 4: Equal Access count<br/>non-increasing?}
    F -- no --> RV
    F -- yes --> G{Critic verdict<br/>semantic truth?}
    G -- FAIL --> RV
    G -- PASS --> OK[ACCEPT: commit + receipt<br/>+ dashboard tick]
```

## Component contracts

- mapper(violation) → {file, lineStart, lineEnd, confidence} | BLOCKED. Confidence
  below threshold routes to strategy 3 (build-time data-mend-src annotations).
- verify() → {pass, gates: [{name, pass, detail}]}. Fail-fast, but always record
  which gate. Machine-readable json + one human line per gate.
- receipt schema: docs/RUBRIC.md section 6. Written on accept AND revert.
- Dashboard consumes runs/ + receipts/ over ws; it renders state, it never owns it.
- Pomerium sits between Playwright and the served target. Its access log joins the
  evidence trail: every page touched, identity-checked, policy-scoped.
- Zero runs once, at loop end, as the agent's own final act: deploy healed build,
  return shareable URL, write it into the final receipt.
