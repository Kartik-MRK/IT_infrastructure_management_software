# 🔒 Cryptographic Audit Logging & Tamper-Evident Ledger Guide

## Overview

This guide details the database architecture, SHA-256 hash chaining mathematical model, cryptographic chain integrity verification sweeps, and SOC 2 Type II compliance certificate generation for the **Cryptographic Audit Logging** module in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In conventional IT infrastructure systems:
- Standard audit trails stored in plaintext relational tables can be secretly modified, truncated, or forged by rogue database administrators or attackers who gain SQL access.
- Compliance frameworks such as **SOC 2 Type II (Trust Services Criteria CC6.1 - CC6.3)**, **ISO 27001 (Annex A.12.4)**, and **HIPAA Security Rule §164.312(b)** require cryptographically verifiable, tamper-evident audit logging.

**The Solution**:
1. **Blockchain-Style Hash Chaining**: Every audit entry stores the previous block's hash (`prev_hash`) and calculates its own cryptographic hash (`entry_hash`) over its normalized canonical payload:
   $$\text{entry\_hash}_N = \text{SHA256}\left(\text{prev\_hash}_{N-1} \parallel \text{actor\_email} \parallel \text{action} \parallel \text{entity\_type} \parallel \text{entity\_id} \parallel \text{payload}\right)$$
2. **Automated Cryptographic Integrity Sweep (`verify_audit_log_chain_integrity`)**: Iterates through the entire ledger, recomputes hashes from the Genesis block, and flags any altered, forged, or missing records with zero tolerance.
3. **Official SOC 2 Compliance Certificates (`generate_compliance_certificate`)**: Produces formal, verifiable compliance proofs embedding the Merkle Tip Hash, total audited blocks, verification timestamp, and cryptographic validity seal.
4. **Interactive Ledger UI (`CryptographicLedger.jsx`)**: Real-time shield banner, sequence timeline table, copyable hash digests, expandable JSON payloads, and native printable certificates.

---

## 🏛️ 1. Relational Database Schema & Stored Procedures

All cryptographic audit logs and verification logic are implemented directly in PostgreSQL 17 on Supabase (`odgxypyknkqlcasvomej`):

### 1.1 `public.cryptographic_audit_logs` Table
```sql
CREATE TABLE IF NOT EXISTS public.cryptographic_audit_logs (
    sequence_number     BIGSERIAL   PRIMARY KEY,
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    actor_id            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email         TEXT        NOT NULL,
    action              TEXT        NOT NULL,
    entity_type         TEXT        NOT NULL,
    entity_id           TEXT        NOT NULL,
    payload             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    client_ip           TEXT        DEFAULT '127.0.0.1',
    user_agent          TEXT        DEFAULT 'ITIMS-Core',
    prev_hash           TEXT        NOT NULL,
    entry_hash          TEXT        NOT NULL,
    signature_algorithm TEXT        NOT NULL DEFAULT 'SHA-256',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_audit_seq ON public.cryptographic_audit_logs(sequence_number);
CREATE INDEX IF NOT EXISTS idx_crypto_audit_action ON public.cryptographic_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_crypto_audit_created ON public.cryptographic_audit_logs(created_at DESC);
```

### 1.2 `public.append_cryptographic_audit_log(...)` Stored Procedure
- Queries the latest sequence's `entry_hash` (or defaults to the 64-zero Genesis hash for block #1).
- Concatenates the canonical payload string with deterministic delimiters.
- Computes `encode(sha256(raw_content::bytea), 'hex')`.
- Appends the new immutable record.

### 1.3 `public.verify_audit_log_chain_integrity()` Stored Procedure
- Traverses the entire audit log sequentially.
- Validates chain continuity ($\text{prev\_hash}_N = \text{entry\_hash}_{N-1}$).
- Re-hashes the payload and verifies against stored `entry_hash`.
- Returns: `is_valid: boolean`, `total_records: int`, `tampered_records_count: int`, `broken_sequence_numbers: int[]`, `merkle_head_hash: text`.

### 1.4 `public.generate_compliance_certificate(p_auditor_name TEXT)` Stored Procedure
- Executes the integrity sweep and packages a signed compliance proof document with a unique Certificate UUID.

---

## 📡 2. Backend REST API Endpoints

| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/audit-ledger/verify` | Run automated cryptographic integrity verification sweep | Authenticated |
| `GET` | `/api/audit-ledger` | List immutable hash-chained audit records with filters | Authenticated |
| `GET` | `/api/audit-ledger/compliance-certificate` | Generate & export signed SOC 2 Type II audit certificate | Authenticated |
| `POST` | `/api/audit-ledger/log` | Append custom audit record to cryptographic chain | Authenticated |

---

## 🔒 3. Mathematical Verification Model

For an audit chain of length $N$:
1. **Genesis Block ($N=1$)**:
   $$\text{prev\_hash}_1 = \text{"0000000000000000000000000000000000000000000000000000000000000000"}$$
2. **Sequential Chaining ($N > 1$)**:
   $$\text{prev\_hash}_N = \text{entry\_hash}_{N-1}$$
   $$\text{entry\_hash}_N = \text{SHA256}(\text{prev\_hash}_N \parallel \text{actor} \parallel \text{action} \parallel \text{type} \parallel \text{id} \parallel \text{payload})$$
3. **Tamper Proof**: Modifying even 1 byte in a historical record changes its `entry_hash`, creating an immediate mismatch with `prev_hash_{N+1}` across all subsequent blocks, which the integrity sweep instantly flags.

---

## 🎨 4. Frontend Visual Components

1. **`CryptographicLedger.jsx`** (`/audit-ledger`):
   - **Hero Shield Banner**: Displays live verification status badge (`✓ Tamper-Proof Chain` or `⚠️ Integrity Compromised`).
   - **Integrity Sweep Action**: "Run Integrity Sweep" button with instant verification feedback.
   - **SOC 2 Export Action**: "Export SOC 2 Certificate" button opening a formal certificate modal with print-to-PDF styles.
   - **Ledger Table**:
     - Sequence # pill (`#0001`, `#0002`...)
     - Timestamp & Actor Email + IP address.
     - Action & Entity badges.
     - Hash Chaining link display (`Prev Hash` $\to$ `Entry Hash`) with 1-click clipboard copy.
     - JSON Payload modal viewer.
2. **`Navbar.jsx`**:
   - Added **"🔒 Audit Ledger"** navigation link to the main menu.
