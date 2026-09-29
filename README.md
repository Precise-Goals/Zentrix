# Zentrix ⚡

**Autonomous Milestone Escrow & AI Talent Matchmaking on MST Blockchain**  
*MST Blockchain × NEWRRO Buildathon 2026 · BMS College of Engineering, Bengaluru*

[![MST Blockchain Testnet](https://img.shields.io/badge/MST%20Testnet-Chain%2091562037-D84040?style=for-the-badge&logo=blockchain.com&logoColor=white)](https://testnet.mstscan.com)
[![Sarvam AI 30B](https://img.shields.io/badge/AI%20Engine-Sarvam%2030B-A31D1D?style=for-the-badge)](https://www.sarvam.ai)
[![Bun Runtime](https://img.shields.io/badge/Runtime-Bun-ECDCBF?style=for-the-badge&logo=bun&logoColor=2A0F0F)](https://bun.sh)
[![Vite](https://img.shields.io/badge/Frontend-Vite%205-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F7D4F?style=for-the-badge)](./LICENSE)

> *"Don't just build on blockchain — build something that becomes strictly better because of blockchain."*

---

## 📖 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Verified Testnet Deployments](#-verified-testnet-deployments)
- [User Experience & Bento UI](#-user-experience--bento-ui)
- [Smart Contract Deep Dive](#-smart-contract-deep-dive)
- [Sarvam AI Integration](#-sarvam-ai-integration)
- [Navigation & Wireframe Specification](#-navigation--wireframe-specification)
- [Getting Started & Local Development](#-getting-started--local-development)
- [Verification & Gate Enforcement](#-verification--gate-enforcement)
- [Security & Compliance](#-security--compliance)
- [License](#-license)

---

## 🌟 Overview

Zentrix is a decentralized, freelance marketplace built to solve the universal freelance trust dilemma. On Web2 platforms (like Upwork or Fiverr), payments and accounts are subjected to arbitrary holds, high 10–20% rake fees, and opaque dispute processes. 

Zentrix anchors **money, milestones, agreements, and professional reputation directly on the MST Blockchain**, combined with **Sarvam AI (30B)** for privacy-preserving talent discovery.

### The Zentrix Advantage
1. **Zero Platform Commission (0%):** Value flows directly between client and freelancer without middleman extraction.
2. **Autonomous Milestone Escrow:** Client funds 100% upfront in `tMSTC`. Funds are locked non-custodially in smart contracts.
3. **72-Hour Auto-Release Guarantee:** Eliminates client ghosting. If a client goes unresponsive after milestone delivery, the smart contract unlocks funds automatically to the freelancer.
4. **Soulbound Credentials (ERC-721):** Completing milestones mints permanent, non-transferable on-chain credentials. Reputation cannot be purchased, transferred, or deleted by a centralized company.
5. **Private AI Matchmaking:** Server-side Sarvam 30B LLM matches requirements with verified talent while guaranteeing zero Personally Identifiable Information (PII) leakage.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["🖥️ Frontend Client (Vite + React 18 + Bun)"]
        UI["High-Fidelity Bento Grid UI"]
        Auth["Firebase Auth + Profile"]
        WalletCtx["Wallet Provider (BridgeKey / EIP-1193)"]
        MST_SDK["@mstblockchain/mst-sdk + ethers v6"]
    end

    subgraph ServerLayer["⚙️ Server Runtime (Bun Native HTTP :3001)"]
        Proxy["API Gateway & Usage Metering"]
        AuthNonce["EIP-191 Nonce & Signature Verification"]
        SarvamProxy["Sarvam 30B Agent (Tool Calling)"]
    end

    subgraph ChainLayer["⛓️ MST Blockchain Testnet (Chain ID 91562037)"]
        Escrow["ZentrixEscrow.sol<br/>(Milestone Locking & Payouts)"]
        Reputation["ZentrixReputation.sol<br/>(Soulbound SBT Credentials)"]
        Pass["ZentrixPass.sol<br/>(Tiered ERC-721 AI Passes)"]
    end

    subgraph StorageLayer["☁️ Decentralized & Off-Chain Indexing"]
        Firestore["Cloud Firestore (Gigs, Profiles, Applications)"]
        IPFS["IPFS Storage (Delivery Evidence CIDs)"]
    end

    UI --> WalletCtx
    WalletCtx --> MST_SDK
    MST_SDK -->|Transactions & State Reads| ChainLayer
    UI -->|REST / Streaming| Proxy
    Proxy --> SarvamProxy
    SarvamProxy -->|Private RAG & Tools| Firestore
    UI --> Auth
    Auth --> Firestore
    Escrow -->|On Approval Mint| Reputation
```

---

## 🛡️ Key Features

### 1. Trust-Minimized Milestone Escrow (`ZentrixEscrow.sol`)
- **Upfront Full Funding:** Clients deposit the entire project budget in `tMSTC` upon contract creation.
- **Pull Payments:** Freelancers withdraw approved funds on their own terms via the Checks-Effects-Interactions pattern, preventing reentrancy and DOS attacks.
- **Negotiated Deadlines:** Freelancer and client can mutually propose and accept deadline extensions on-chain.
- **Fair Arbiter Dispute Path:** If a milestone submission is rejected and disputed, an designated arbiter can fairly split or allocate remaining milestone funds.

### 2. Soulbound Reputation Credentials (`ZentrixReputation.sol`)
- Non-transferable ERC-721 tokens minted upon milestone completion.
- Reverts any `transferFrom` or `safeTransferFrom` invocation.
- Provides cryptographic proof of past work, job ratings, and verifiable competencies on MSTScan.

### 3. ZentrixPass NFT Access (`ZentrixPass.sol`)
- Tiered subscription passes stored on-chain:
  - **Free Tier:** 2 AI queries / day (Available to all connected wallets).
  - **Scout Pass (Tier 1):** 5 AI queries / day, Scout badge, priority AI match scoring.
  - **Builder Pass (Tier 2):** 15 AI queries / day, Builder profile badge, priority dispute queue.
  - **Architect Pass (Tier 3):** Unlimited AI queries / day, Enterprise badge, maximum throughput.
- Enforced on-chain with 30-day auto-expiry (`PASS_DURATION = 30 days`).

### 4. Sarvam 30B Talent Matchmaking
- Server-side tool calling powered by Sarvam's `sarvam-30b` model.
- Analyzes project budgets, milestone deliverables, and candidate portfolios.
- **DPDP Act 2023 Compliance:** Phone numbers, personal email addresses, and private identities are automatically redacted prior to processing.

---

## 🔗 Verified Testnet Deployments

All Zentrix contracts are deployed, active, and verified on **MST Blockchain Testnet**:

| Contract Name | Address | Explorer Link |
|---|---|---|
| **`ZentrixEscrow`** | `0x8b6475a6C378625775Ca46447Fc52e483de896be` | [View on MSTScan](https://testnet.mstscan.com/address/0x8b6475a6C378625775Ca46447Fc52e483de896be) |
| **`ZentrixReputation`** | `0x2a0f4cB2c514edde59762D685EE57D0678813935` | [View on MSTScan](https://testnet.mstscan.com/address/0x2a0f4cB2c514edde59762D685EE57D0678813935) |
| **`ZentrixPass`** | `0x3EDad230dCFc6Dd3C357490b9feDa49639646BB7` | [View on MSTScan](https://testnet.mstscan.com/address/0x3EDad230dCFc6Dd3C357490b9feDa49639646BB7) |

### On-Chain Proof Transactions

| Action | Transaction Hash | Status | Explorer Link |
|---|---|---|---|
| **Deploy Contracts** | `0x03f4a7c32f86c9eb639ad210070c1555bf88133b7ab4957160531828956650e0` | Confirmed | [MSTScan Tx](https://testnet.mstscan.com/tx/0x03f4a7c32f86c9eb639ad210070c1555bf88133b7ab4957160531828956650e0) |
| **Fund Demo Client** | `0x03f4a7c32f86c9eb639ad210070c1555bf88133b7ab4957160531828956650e0` | Confirmed | [MSTScan Tx](https://testnet.mstscan.com/tx/0x03f4a7c32f86c9eb639ad210070c1555bf88133b7ab4957160531828956650e0) |
| **Fund Demo Freelancer**| `0x24feec36f0bf14315aad3a89ab43b101f741d3789d9c7b62c135c4217d484014` | Confirmed | [MSTScan Tx](https://testnet.mstscan.com/tx/0x24feec36f0bf14315aad3a89ab43b101f741d3789d9c7b62c135c4217d484014) |

---

## 🎨 User Experience & Bento UI

The application avoids standard generic boilerplate templates and instead implements custom, high-fidelity UI elements:

- **2.5s Branded Splash Screen:** Displays an animated Zentrix mark, progress bar, real-time connectivity feedback, and MST chain validation before seamless page reveal.
- **Asymmetric Bento Grid Design:** Card layouts feature high-radius geometric boundaries (`rounded-3xl` / `24px+`), bold dark/cream contrast, and clean typographic hierarchy.
- **Strict Theme Token Enforcement:** Powered by `src/styles/tokens.css`. Zero raw hex values in components:
  - Primary Red: `#D84040` (`--zx-primary`)
  - Deep Red: `#A31D1D` (`--zx-primary-deep`)
  - Warm Cream: `#ECDCBF` (`--zx-cream`)
  - Dark Ink: `#2A0F0F` (`--zx-ink`)
  - Soft Surface: `#F7EFDF` (`--zx-surface`)
- **Live On-Chain Data:** Dashboard, Pricing, and Marketplace query live contract methods (`withdrawable()`, `tierPrices()`, `tierOf()`, `balanceOf()`) rather than rendering placeholder mocks.

---

## 🧩 Smart Contract Reference

All contracts are written in **Solidity `^0.8.20`**, use **OpenZeppelin v5**, and are deployed exclusively on **MST Blockchain Testnet (Chain ID `91562037`)**. No mainnet deployments exist. Source: [`contracts/contracts/`](./contracts/contracts/)

```
contracts/
├── contracts/
│   ├── ZentrixEscrow.sol        # Multi-milestone escrow with auto-release & dispute resolution
│   ├── ZentrixReputation.sol    # Soulbound ERC-721 credential tokens (non-transferable)
│   └── ZentrixPass.sol          # Subscription passes with 30-day duration & tier pricing
├── test/
│   ├── ZentrixEscrow.test.ts    # Comprehensive test suite (15 passing tests)
│   └── test-helpers.ts          # Mock timestamps and ethers helpers
└── hardhat.config.ts            # Network config for MST Testnet (Chain 91562037)
```

---

### 1. `ZentrixEscrow.sol`

> **Address:** [`0x8b6475a6C378625775Ca46447Fc52e483de896be`](https://testnet.mstscan.com/address/0x8b6475a6C378625775Ca46447Fc52e483de896be)  
> **Inherits:** `AccessControl`, `Pausable`, `ReentrancyGuard` (OpenZeppelin v5)

Trust-minimized, multi-milestone project escrow. Client funds are locked non-custodially on gig creation; freelancer payments are released per-milestone via pull-payment withdrawal, preventing reentrancy and DOS.

#### Access Roles

| Role | Constant | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | — | Contract administration and role grants |
| `ARBITER_ROLE` | `keccak256("ARBITER_ROLE")` | Dispute resolution — split milestone funds |
| `PAUSER_ROLE` | `keccak256("PAUSER_ROLE")` | Emergency pause / unpause |

#### Enumerations

```solidity
enum GigStatus  { Open, Assigned, Active, Completed, Cancelled }
enum MStatus    { Pending, Submitted, Approved, Rejected, Disputed, Resolved, AutoReleased }
```

#### Structs

| Struct | Fields | Description |
|---|---|---|
| `Gig` | `id`, `client`, `freelancer`, `status`, `reviewWindow`, `assignedAt`, `agreementHash`, `agreementCID`, `metadataCID`, `milestoneCount` | On-chain project agreement record |
| `Milestone` | `amount` (`uint96`), `deadline`, `criteriaHash`, `status`, `submittedAt`, `evidenceCID`, `reasonCID` | Per-milestone state |
| `MilestonePlan` | `amount`, `deadline`, `criteriaHash` | Input struct for `createGig` |
| `DeadlineProposal` | `newDeadline`, `proposedBy`, `pending` | Mutual deadline extension proposal |

#### State Variables

| Variable | Type | Description |
|---|---|---|
| `gigs` | `mapping(uint256 => Gig)` | All gig records by on-chain ID |
| `milestones` | `mapping(uint256 => mapping(uint256 => Milestone))` | Milestone state per gig ID and index |
| `deadlineProposals` | `mapping(uint256 => mapping(uint256 => DeadlineProposal))` | Pending deadline proposals |
| `withdrawable` | `mapping(address => uint256)` | Pull-payment balance per address |
| `totalLockedMilestoneFunds` | `uint256` | Invariant: total tMSTC locked in active milestones |
| `totalWithdrawableFunds` | `uint256` | Invariant: total tMSTC available for withdrawal |
| `reputationContract` | `IZentrixReputation` | Reference to ZentrixReputation for SBT minting |

#### Functions

| Function | Visibility | Modifier(s) | Description |
|---|---|---|---|
| `createGig(metadataCID, plan[], reviewWindow)` | `external payable` | `whenNotPaused`, `nonReentrant` | Creates a gig, locks total `tMSTC`. Emits `GigCreated`. |
| `assignAndFund(gigId, freelancer, agreementHash, agreementCID)` | `external` | `whenNotPaused`, `nonReentrant` | Client assigns freelancer, records agreement. `Open → Assigned`. Emits `Funded`, `AgreementSigned`. |
| `acceptAssignment(gigId)` | `external` | `whenNotPaused` | Freelancer accepts. `Assigned → Active`. Emits `AgreementSigned`. |
| `cancelUnaccepted(gigId)` | `external` | `whenNotPaused`, `nonReentrant` | Client cancels after 48-hour window. Full refund to `withdrawable[client]`. Emits `GigCancelled`. |
| `submitMilestone(gigId, i, evidenceCID)` | `external` | `whenNotPaused` | Freelancer anchors deliverable proof. `Pending/Rejected → Submitted`. Emits `MilestoneSubmitted`. |
| `approveMilestone(gigId, i, rating)` | `external` | `whenNotPaused`, `nonReentrant` | Client approves. Releases funds to `withdrawable[freelancer]`. Triggers SBT mint on final milestone. Emits `MilestoneApproved`. |
| `rejectMilestone(gigId, i, reasonCID)` | `external` | `whenNotPaused` | Client rejects with mandatory reason CID. `Submitted → Rejected`. Emits `MilestoneRejected`. |
| `autoRelease(gigId, i)` | `external` | `whenNotPaused`, `nonReentrant` | Anyone triggers release after `reviewWindow` expires. Emits `MilestoneAutoReleased`. |
| `raiseDispute(gigId, i)` | `external` | `whenNotPaused` | Freelancer escalates rejected milestone. `Rejected → Disputed`. Emits `MilestoneDisputed`. |
| `resolveDispute(gigId, i, freelancerBps, rulingCID)` | `external` | `ARBITER_ROLE`, `whenNotPaused`, `nonReentrant` | Arbiter splits funds by basis points (0–10000). Emits `MilestoneResolved`. |
| `proposeDeadline(gigId, i, newDeadline)` | `external` | `whenNotPaused` | Either party proposes a deadline extension. Emits `DeadlineProposed`. |
| `acceptDeadline(gigId, i)` | `external` | `whenNotPaused` | Counterparty accepts deadline proposal. Emits `DeadlineAccepted`. |
| `withdraw()` | `external` | `nonReentrant` | Pull-payment: moves full `withdrawable[msg.sender]` to caller. Emits `Withdrawn`. |
| `getMilestones(gigId)` | `external view` | — | Returns full `Milestone[]` array for a gig. |
| `setReputationContract(newContract)` | `external` | `DEFAULT_ADMIN_ROLE` | Updates ZentrixReputation reference. Emits `ReputationContractUpdated`. |
| `pause()` / `unpause()` | `external` | `PAUSER_ROLE` | Emergency circuit breaker. |

#### Events

| Event | Parameters | Emitted When |
|---|---|---|
| `GigCreated` | `gigId`, `client`, `reviewWindow`, `totalBudget` | New gig created and funded |
| `Funded` | `gigId`, `client`, `freelancer`, `totalAmount` | Freelancer assigned, agreement locked |
| `AgreementSigned` | `gigId`, `party`, `agreementHash` | Client or freelancer acknowledges agreement |
| `MilestoneSubmitted` | `gigId`, `milestoneIndex`, `evidenceCID` | Freelancer anchors deliverable proof |
| `MilestoneApproved` | `gigId`, `milestoneIndex`, `amount`, `rating` | Client approves, funds released |
| `MilestoneRejected` | `gigId`, `milestoneIndex`, `reasonCID` | Client rejects with mandatory reason |
| `MilestoneDisputed` | `gigId`, `milestoneIndex` | Freelancer raises dispute |
| `MilestoneResolved` | `gigId`, `milestoneIndex`, `freelancerBps`, `rulingCID` | Arbiter issues ruling |
| `MilestoneAutoReleased` | `gigId`, `milestoneIndex`, `amount` | Auto-release after review window |
| `DeadlineProposed` | `gigId`, `milestoneIndex`, `newDeadline`, `proposedBy` | Deadline extension proposed |
| `DeadlineAccepted` | `gigId`, `milestoneIndex`, `newDeadline` | Counterparty accepts deadline |
| `Withdrawn` | `recipient`, `amount` | Pull-payment successfully executed |
| `GigCompleted` | `gigId`, `freelancer` | All milestones resolved |
| `GigCancelled` | `gigId`, `refundAmount` | Unaccepted gig cancelled, client refunded |
| `ReputationContractUpdated` | `newContract` | Admin updates reputation contract |

#### Custom Errors

| Error | Condition |
|---|---|
| `GigNotFound()` | Gig ID does not exist (`client == address(0)`) |
| `NotGigClient()` | Caller is not the gig's client |
| `NotGigFreelancer()` | Caller is not the assigned freelancer |
| `Unauthorized()` | Caller is neither client nor freelancer |
| `InvalidGigStatus(expected, current)` | Gig is not in the required status |
| `InvalidMilestoneIndex()` | Milestone index ≥ `milestoneCount` |
| `InvalidMilestoneStatus(expected, current)` | Milestone is not in the required status |
| `IncorrectFundingAmount(expected, provided)` | `msg.value` doesn't match milestone sum |
| `ReviewWindowNotPassed()` | Auto-release before `reviewWindow` elapsed |
| `AcceptancePeriodNotPassed()` | Cancel before 48-hour acceptance window |
| `InvalidDisputeSplit()` | `freelancerBps > 10000` |
| `NoWithdrawableFunds()` | `withdrawable[msg.sender] == 0` |
| `ZeroAddress()` | Supplied address is `address(0)` |
| `EmptyCID()` | Empty string CID supplied |
| `ProposalAlreadyPending()` | Deadline proposal already exists |
| `NoPendingProposal()` | No proposal exists to accept |
| `CannotAcceptOwnProposal()` | Proposer tries to self-accept |

---

### 2. `ZentrixReputation.sol`

> **Address:** [`0x2a0f4cB2c514edde59762D685EE57D0678813935`](https://testnet.mstscan.com/address/0x2a0f4cB2c514edde59762D685EE57D0678813935)  
> **Inherits:** `ERC721`, `AccessControl`, `Pausable` (OpenZeppelin v5)  
> **Token:** `ZXREP` — `Zentrix Reputation`

Strictly **non-transferable (Soulbound) ERC-721** credential tokens minted by `ZentrixEscrow` on final milestone approval. Any transfer attempt is reverted at the `_update` hook level.

#### Access Roles

| Role | Constant | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | — | Contract administration |
| `MINTER_ROLE` | `keccak256("MINTER_ROLE")` | Authorized to mint (granted to `ZentrixEscrow`) |
| `PAUSER_ROLE` | `keccak256("PAUSER_ROLE")` | Emergency pause / unpause |

#### Structs

| Struct | Fields | Description |
|---|---|---|
| `ReputationData` | `gigId` (`uint256`), `rating` (`uint8`, 1–5), `completedAt` (`uint64`), `evidenceCID` (`string`) | Immutable metadata on each credential NFT |

#### State Variables

| Variable | Type | Description |
|---|---|---|
| `_reputations` | `mapping(uint256 => ReputationData)` | Credential metadata per token ID |
| `_userTokens` | `mapping(address => uint256[])` | Token IDs held by each address |
| `_ratingSum` | `mapping(address => uint256)` | Cumulative rating sum per address |
| `_ratingCount` | `mapping(address => uint256)` | Completed gig count per address |
| `_tokenURIs` | `mapping(uint256 => string)` | Optional on-chain token URI |

#### Functions

| Function | Visibility | Modifier(s) | Description |
|---|---|---|---|
| `mintReputation(to, gigId, rating, evidenceCID)` | `external` | `MINTER_ROLE`, `whenNotPaused` | Mints a soulbound credential, stores metadata, updates rating aggregates. Emits `ReputationMinted`. |
| `getReputationScore(account)` | `external view` | — | Returns `(scoreBps, completedCount)`. `scoreBps` = average rating × 100 (e.g. `480` = 4.80/5). |
| `getReputation(tokenId)` | `external view` | — | Returns `ReputationData` for a token ID. |
| `getUserTokens(account)` | `external view` | — | Returns all token IDs owned by `account`. |
| `totalSupply()` | `external view` | — | Returns total credentials minted. |
| `pause()` / `unpause()` | `external` | `PAUSER_ROLE` | Emergency circuit breaker. |
| `_update(to, tokenId, auth)` | `internal override` | `whenNotPaused` | **Soulbound enforcement:** reverts any transfer between non-zero addresses. |

#### Events

| Event | Parameters | Emitted When |
|---|---|---|
| `ReputationMinted` | `tokenId`, `freelancer`, `gigId`, `rating` | New credential minted on milestone completion |

#### Reverts

| Condition | Behaviour |
|---|---|
| `rating < 1 \|\| rating > 5` | Reverts with `"ZentrixReputation: rating must be between 1 and 5"` |
| `to == address(0)` | Reverts with `"ZentrixReputation: zero address"` |
| Transfer between non-zero addresses | `_update` reverts with `"ZentrixReputation: soulbound, non-transferable"` |

---

### 3. `ZentrixPass.sol`

> **Address:** [`0x3EDad230dCFc6Dd3C357490b9feDa49639646BB7`](https://testnet.mstscan.com/address/0x3EDad230dCFc6Dd3C357490b9feDa49639646BB7)  
> **Inherits:** `ERC721`, `AccessControl`, `Pausable`, `ReentrancyGuard` (OpenZeppelin v5)  
> **Token:** `ZXPASS` — `Zentrix Pass`

Tiered **soulbound ERC-721** subscription NFTs gating daily AI query quotas in the Sarvam 30B agent. Passes expire after 30 days; excess payment is automatically refunded.

#### Access Roles

| Role | Constant | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | — | Update tier pricing, withdraw fees |
| `PAUSER_ROLE` | `keccak256("PAUSER_ROLE")` | Emergency pause / unpause |

#### Constants & Tier Pricing (Testnet)

| Constant | Value | Description |
|---|---|---|
| `PASS_DURATION` | `30 days` | Subscription validity after purchase |

| Tier | Label | Price | Daily AI Queries |
|---|---|---|---|
| `0` | Free | Free (no NFT required) | 2 / day |
| `1` | PRO | `5 tMSTC` | 10 / day |
| `2` | Enterprise | `15 tMSTC` | 15 / day |

Prices live in `tierPrices[tier]` and are updatable by admin.

#### Structs

| Struct | Fields | Description |
|---|---|---|
| `PassData` | `tier` (`uint8`), `expiresAt` (`uint64`), `tokenId` (`uint256`) | Active pass record per wallet |

#### State Variables

| Variable | Type | Description |
|---|---|---|
| `activePasses` | `mapping(address => PassData)` | Active pass per wallet (overwritten on renewal/upgrade) |
| `tierPrices` | `mapping(uint8 => uint256)` | Price in wei per tier |

#### Functions

| Function | Visibility | Modifier(s) | Description |
|---|---|---|---|
| `buy(tier)` | `external payable` | `whenNotPaused`, `nonReentrant` | Purchases 30-day pass for tier 1 or 2. Mints ERC-721, records `PassData`, auto-refunds excess. Emits `PassPurchased`. |
| `tierOf(account)` | `external view` | — | Returns active tier (`0` if no pass or expired). Used by agent engine for quota enforcement. |
| `getPass(account)` | `external view` | — | Returns `(tier, expiresAt, tokenId)`. |
| `setPrice(tier, priceWei)` | `external` | `DEFAULT_ADMIN_ROLE` | Updates tier price. Emits `PriceUpdated`. |
| `withdrawFees()` | `external` | `DEFAULT_ADMIN_ROLE`, `nonReentrant` | Admin withdraws accumulated pass purchase fees. |
| `pause()` / `unpause()` | `external` | `PAUSER_ROLE` | Emergency circuit breaker. |
| `_update(to, tokenId, auth)` | `internal override` | `whenNotPaused` | **Soulbound enforcement:** reverts transfers between non-zero addresses. |

#### Events

| Event | Parameters | Emitted When |
|---|---|---|
| `PassPurchased` | `buyer`, `tokenId`, `tier`, `expiresAt` | New pass subscription minted |
| `PriceUpdated` | `tier`, `newPrice` | Admin updates a tier's price |

#### Reverts

| Condition | Behaviour |
|---|---|
| `tier != 1 && tier != 2` | Reverts with `"ZentrixPass: invalid tier"` |
| `msg.value < tierPrices[tier]` | Reverts with `"ZentrixPass: insufficient payment"` |
| Excess refund call fails | Reverts with `"ZentrixPass: excess refund failed"` |
| `withdrawFees()` on zero balance | Reverts with `"ZentrixPass: zero balance"` |
| Transfer between non-zero addresses | `_update` reverts with `"ZentrixPass: soulbound, non-transferable"` |

---

### Test Suite Results
```bash
bun x hardhat test
```
```
  ZentrixEscrow & ZentrixReputation
    Gig Creation & Funding
      ✔ should allow a client to create a gig with a valid plan
      ✔ should revert funding if msg.value does not equal sum(plan)
    Lifecycle: Acceptance, Submission, Approval, Withdrawal
      ✔ should complete golden path: accept -> submit -> approve -> withdraw
      ✔ should allow client to cancel unaccepted gig after 48 hours
    Dispute Resolution & Auto-Release
      ✔ should auto-release milestone funds after reviewWindow expires
      ✔ should handle reject -> dispute -> arbiter split correctly
    Deadline Negotiation
      ✔ should require proposal and mutual acceptance for deadline extension
    Soulbound Tokens: Transfer Reversion
      ✔ should revert any transfer of Reputation NFT between users

  ZentrixPass
    ✔ should have correct initial tier prices
    ✔ should allow purchasing Pro Pass (Tier 1) and report tier 1
    ✔ should refund excess payment when buying a pass
    ✔ should expire after 30 days and return tier 0
    ✔ should revert transfer between accounts (soulbound)
    ✔ should allow admin to update tier price
    ✔ should allow admin to withdraw accumulated fees

  15 passing (986ms)
```

---

## 🤖 Sarvam AI Integration

Sarvam AI (`sarvam-30b`) powers the intelligent matchmaking features:
- **Server-Side Exclusivity:** The browser never directly contacts the AI provider or exposes keys.
- **Tool Calling:** The model invokes specialized tools (`search_gigs`, `search_freelancers`) through the Bun server.
- **Quota & Tier Metering:** Each query consumes daily credits associated with the wallet's `ZentrixPass` tier. Daily quotas reset at **IST midnight (18:30 UTC)**.

---

## 🧭 Navigation & Wireframe Specification

- **Logo:** Direct link to Home.
- **Home (`/`):** Hero headline, animated live metrics, core pillars, and golden path walkthrough.
- **About (`/about`):** Technical architecture bento grid, live network parameters, contract cards with copyable addresses.
- **Products:**
  - **Marketplace (`/marketplace`):** Filter by tags (Web3, AI, Smart Contracts), search gigs, post custom milestone gig, apply with proposal.
  - **AI Agents (`/agent`):** Chat bubble interface with suggestions, loading dots, and server-side Sarvam 30B streaming.
- **Monitor:**
  - **Pricing (`/pricing`):** ZentrixPass tiers, live `tierPrices()` on-chain prices, and instant minting.
  - **Dashboard (`/dashboard`):** Real-time `withdrawable()` balance, pull withdrawal button, milestone breakdown, and soulbound credentials.
- **Login / Onboarding:**
  - Firebase Authentication (Google / Email).
  - Role selection (Client or Freelancer).
  - Mandatory BridgeKey wallet binding via EIP-191 personal sign.

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Bun** (v1.3.14 or newer) installed. [Get Bun](https://bun.sh)
- **BridgeKey Extension** (Chrome Web Store) or compatible EVM wallet.
- **MST Testnet RPC:** `https://testnetrpc.mstblockchain.com`
- **Chain ID:** `91562037`
- **MST Testnet Faucet:** [https://faucet.masterstroke.academy](https://faucet.masterstroke.academy)

### 1. Clone & Install
```bash
git clone https://github.com/Precise-Goals/Zentrix.git
cd Zentrix

# Install dependencies using Bun
bun install
```

### 2. Environment Setup
Copy the sample environment file and provide your credentials in `.env.local`:
```bash
cp .env.example .env.local
```
Key variables:
```ini
# MST Testnet
MST_TESTNET_RPC=https://testnetrpc.mstblockchain.com
CHAIN_ID=91562037

# Deployer / Keys
DEPLOYER_PRIVATE_KEY=your_private_key_here
DEMO_CLIENT_ADDRESS=0x7FC1d02922d4865fd53De59697407a42e64d1Cad
DEMO_FREELANCER_ADDRESS=0x8cA0f3176997F32CCBb4598Fc8C966C95aeEEc9e

# Sarvam AI
SARVAM_API_KEY=your_sarvam_api_key_here

# Firebase
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=growup-dec3f
```

### 3. Launch Development Server (Parallel Frontend + Backend)
```bash
bun run dev
```
This concurrently starts:
- **Vite React Frontend:** [`http://localhost:3000`](http://localhost:3000)
- **Bun Backend Server:** [`http://localhost:3001`](http://localhost:3001)

### 4. Build for Production
```bash
bun run build
```

---

## 🔒 Verification & Gate Enforcement

The repository includes an automated verification gate script (`scripts/gate.sh`) that validates contract safety, secret hygiene, token styling, and live testnet proof:

```bash
# Run all 6 gates
bash scripts/gate.sh all
```

Individual gate checks:
- `bash scripts/gate.sh env` — Validates RPC connectivity and testnet balance requirements.
- `bash scripts/gate.sh contracts` — Compiles contracts, runs Solhint, and executes 15 Hardhat tests.
- `bash scripts/gate.sh web` — Executes TypeScript typecheck and production Vite build.
- `bash scripts/gate.sh secrets` — Scans for leaked private keys, API tokens, and credentials.
- `bash scripts/gate.sh theme` — Verifies zero raw hex color strings exist outside `tokens.css`.
- `bash scripts/gate.sh proof` — Confirms deployed contracts and proof transactions on MSTScan.

---

## 🛡️ Security & Compliance

- **No Secrets in Code:** Secrets are strictly prohibited from commits and logs.
- **Testnet-Only Scope:** Hard-gated to Chain ID `91562037`. Mainnet transactions and private networks are rejected.
- **Reentrancy Protection:** All value-transferring methods in `ZentrixEscrow` utilize OpenZeppelin `ReentrancyGuard` and pull-payment withdrawal patterns.
- **Arbiter Transparency:** For hackathon evaluation, the deployer wallet acts as the dispute arbiter. Mainnet roadmap targets decentralized Kleros/Aragon-style community juries.

---

## 📄 License

This project is open-source and licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for complete terms.

```
MIT License
Copyright (c) 2026 Zentrix Contributors
```
