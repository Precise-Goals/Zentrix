// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IZentrixReputation {
    function mintReputation(
        address to,
        uint256 gigId,
        uint8 rating,
        string calldata evidenceCID
    ) external returns (uint256);
}

/// @title ZentrixEscrow
/// @notice Trust-minimized milestone escrow with automated release, dispute arbitration, and agreement verification.
contract ZentrixEscrow is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum GigStatus { Open, Assigned, Active, Completed, Cancelled }
    enum MStatus { Pending, Submitted, Approved, Rejected, Disputed, Resolved, AutoReleased }

    struct Milestone {
        uint96 amount;
        uint64 deadline;
        bytes32 criteriaHash;
        MStatus status;
        uint64 submittedAt;
        string evidenceCID;
        string reasonCID;
    }

    struct MilestonePlan {
        uint96 amount;
        uint64 deadline;
        bytes32 criteriaHash;
    }

    struct DeadlineProposal {
        uint64 newDeadline;
        address proposedBy;
        bool pending;
    }

    struct Gig {
        uint256 id;
        address client;
        address freelancer;
        GigStatus status;
        uint64 reviewWindow;
        uint64 assignedAt;
        bytes32 agreementHash;
        string agreementCID;
        string metadataCID;
        uint256 milestoneCount;
    }

    error GigNotFound();
    error NotGigClient();
    error NotGigFreelancer();
    error Unauthorized();
    error InvalidGigStatus(GigStatus expected, GigStatus current);
    error InvalidMilestoneIndex();
    error InvalidMilestoneStatus(MStatus expected, MStatus current);
    error IncorrectFundingAmount(uint256 expected, uint256 provided);
    error ReviewWindowNotPassed();
    error AcceptancePeriodNotPassed();
    error InvalidDisputeSplit();
    error NoWithdrawableFunds();
    error ZeroAddress();
    error EmptyCID();
    error ProposalAlreadyPending();
    error NoPendingProposal();
    error CannotAcceptOwnProposal();

    uint256 private _nextGigId = 1;
    IZentrixReputation public reputationContract;

    mapping(uint256 => Gig) public gigs;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(uint256 => DeadlineProposal)) public deadlineProposals;
    mapping(address => uint256) public withdrawable;

    // Invariant tracking
    uint256 public totalLockedMilestoneFunds;
    uint256 public totalWithdrawableFunds;

    event GigCreated(uint256 indexed gigId, address indexed client, uint64 reviewWindow, uint256 totalBudget);
    event Funded(uint256 indexed gigId, address indexed client, address indexed freelancer, uint256 totalAmount);
    event AgreementSigned(uint256 indexed gigId, address indexed party, bytes32 agreementHash);
    event MilestoneSubmitted(uint256 indexed gigId, uint256 indexed milestoneIndex, string evidenceCID);
    event MilestoneApproved(uint256 indexed gigId, uint256 indexed milestoneIndex, uint96 amount, uint8 rating);
    event MilestoneRejected(uint256 indexed gigId, uint256 indexed milestoneIndex, string reasonCID);
    event MilestoneDisputed(uint256 indexed gigId, uint256 indexed milestoneIndex);
    event MilestoneResolved(uint256 indexed gigId, uint256 indexed milestoneIndex, uint16 freelancerBps, string rulingCID);
    event MilestoneAutoReleased(uint256 indexed gigId, uint256 indexed milestoneIndex, uint96 amount);
    event DeadlineProposed(uint256 indexed gigId, uint256 indexed milestoneIndex, uint64 newDeadline, address proposedBy);
    event DeadlineAccepted(uint256 indexed gigId, uint256 indexed milestoneIndex, uint64 newDeadline);
    event Withdrawn(address indexed recipient, uint256 amount);
    event GigCompleted(uint256 indexed gigId, address indexed freelancer);
    event GigCancelled(uint256 indexed gigId, uint256 refundAmount);
    event ReputationContractUpdated(address indexed newContract);

    constructor(address arbiter, address reputation) {
        if (arbiter == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, arbiter);

        if (reputation != address(0)) {
            reputationContract = IZentrixReputation(reputation);
        }
    }

    function setReputationContract(address newContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newContract == address(0)) revert ZeroAddress();
        reputationContract = IZentrixReputation(newContract);
        emit ReputationContractUpdated(newContract);
    }

    /// @notice Creates an open gig with a milestone plan.
    function createGig(
        string calldata metadataCID,
        MilestonePlan[] calldata plan,
        uint64 reviewWindow
    ) external payable whenNotPaused nonReentrant returns (uint256 gigId) {
        require(plan.length > 0, "ZentrixEscrow: plan must have milestones");
        require(reviewWindow >= 1 hours, "ZentrixEscrow: reviewWindow must be >= 1h");

        gigId = _nextGigId++;
        uint256 totalBudget = 0;

        for (uint256 i = 0; i < plan.length; i++) {
            require(plan[i].amount > 0, "ZentrixEscrow: milestone amount must be > 0");
            milestones[gigId][i] = Milestone({
                amount: plan[i].amount,
                deadline: plan[i].deadline,
                criteriaHash: plan[i].criteriaHash,
                status: MStatus.Pending,
                submittedAt: 0,
                evidenceCID: "",
                reasonCID: ""
            });
            totalBudget += plan[i].amount;
        }

        if (msg.value != totalBudget) revert IncorrectFundingAmount(totalBudget, msg.value);

        gigs[gigId] = Gig({
            id: gigId,
            client: msg.sender,
            freelancer: address(0),
            status: GigStatus.Open,
            reviewWindow: reviewWindow,
            assignedAt: 0,
            agreementHash: bytes32(0),
            agreementCID: "",
            metadataCID: metadataCID,
            milestoneCount: plan.length
        });

        totalLockedMilestoneFunds += msg.value;

        emit GigCreated(gigId, msg.sender, reviewWindow, totalBudget);
    }

    /// @notice Assigns a freelancer and deposits full escrow funds for all milestones.
    function assignAndFund(
        uint256 gigId,
        address freelancer,
        bytes32 agreementHash,
        string calldata agreementCID
    ) external whenNotPaused nonReentrant {
        Gig storage gig = gigs[gigId];
        if (gig.client == address(0)) revert GigNotFound();
        if (msg.sender != gig.client) revert NotGigClient();
        if (gig.status != GigStatus.Open) revert InvalidGigStatus(GigStatus.Open, gig.status);
        if (freelancer == address(0)) revert ZeroAddress();

        gig.freelancer = freelancer;
        gig.status = GigStatus.Assigned;
        gig.assignedAt = uint64(block.timestamp);
        gig.agreementHash = agreementHash;
        gig.agreementCID = agreementCID;

        emit Funded(gigId, msg.sender, freelancer, 0);
        emit AgreementSigned(gigId, msg.sender, agreementHash);
    }

    /// @notice Freelancer accepts assignment, transitioning gig into Active state.
    function acceptAssignment(uint256 gigId) external whenNotPaused {
        Gig storage gig = gigs[gigId];
        if (gig.client == address(0)) revert GigNotFound();
        if (msg.sender != gig.freelancer) revert NotGigFreelancer();
        if (gig.status != GigStatus.Assigned) revert InvalidGigStatus(GigStatus.Assigned, gig.status);

        gig.status = GigStatus.Active;
        emit AgreementSigned(gigId, msg.sender, gig.agreementHash);
    }

    /// @notice Client cancels if freelancer does not accept within 48 hours, receiving a full refund.
    function cancelUnaccepted(uint256 gigId) external whenNotPaused nonReentrant {
        Gig storage gig = gigs[gigId];
        if (gig.client == address(0)) revert GigNotFound();
        if (msg.sender != gig.client) revert NotGigClient();
        if (gig.status != GigStatus.Assigned) revert InvalidGigStatus(GigStatus.Assigned, gig.status);
        if (block.timestamp < gig.assignedAt + 48 hours) revert AcceptancePeriodNotPassed();

        gig.status = GigStatus.Cancelled;

        uint256 refund = 0;
        for (uint256 i = 0; i < gig.milestoneCount; i++) {
            refund += milestones[gigId][i].amount;
        }

        totalLockedMilestoneFunds -= refund;
        totalWithdrawableFunds += refund;
        withdrawable[gig.client] += refund;

        emit GigCancelled(gigId, refund);
    }

    /// @notice Freelancer submits milestone delivery evidence.
    function submitMilestone(
        uint256 gigId,
        uint256 i,
        string calldata evidenceCID
    ) external whenNotPaused {
        Gig storage gig = gigs[gigId];
        if (gig.status != GigStatus.Active) revert InvalidGigStatus(GigStatus.Active, gig.status);
        if (msg.sender != gig.freelancer) revert NotGigFreelancer();
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();
        if (bytes(evidenceCID).length == 0) revert EmptyCID();

        Milestone storage m = milestones[gigId][i];
        if (m.status != MStatus.Pending && m.status != MStatus.Rejected) {
            revert InvalidMilestoneStatus(MStatus.Pending, m.status);
        }

        m.status = MStatus.Submitted;
        m.submittedAt = uint64(block.timestamp);
        m.evidenceCID = evidenceCID;

        emit MilestoneSubmitted(gigId, i, evidenceCID);
    }

    /// @notice Client approves milestone, unlocking payment and optionally minting reputation on the final milestone.
    function approveMilestone(
        uint256 gigId,
        uint256 i,
        uint8 rating
    ) external whenNotPaused nonReentrant {
        Gig storage gig = gigs[gigId];
        if (gig.status != GigStatus.Active) revert InvalidGigStatus(GigStatus.Active, gig.status);
        if (msg.sender != gig.client) revert NotGigClient();
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();

        Milestone storage m = milestones[gigId][i];
        if (m.status != MStatus.Submitted) {
            revert InvalidMilestoneStatus(MStatus.Submitted, m.status);
        }

        m.status = MStatus.Approved;
        uint96 amount = m.amount;

        totalLockedMilestoneFunds -= amount;
        totalWithdrawableFunds += amount;
        withdrawable[gig.freelancer] += amount;

        emit MilestoneApproved(gigId, i, amount, rating);

        _checkGigCompletion(gigId, rating, m.evidenceCID);
    }

    /// @notice Client rejects milestone with a mandatory explanation CID.
    function rejectMilestone(
        uint256 gigId,
        uint256 i,
        string calldata reasonCID
    ) external whenNotPaused {
        Gig storage gig = gigs[gigId];
        if (gig.status != GigStatus.Active) revert InvalidGigStatus(GigStatus.Active, gig.status);
        if (msg.sender != gig.client) revert NotGigClient();
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();
        if (bytes(reasonCID).length == 0) revert EmptyCID();

        Milestone storage m = milestones[gigId][i];
        if (m.status != MStatus.Submitted) {
            revert InvalidMilestoneStatus(MStatus.Submitted, m.status);
        }

        m.status = MStatus.Rejected;
        m.reasonCID = reasonCID;

        emit MilestoneRejected(gigId, i, reasonCID);
    }

    /// @notice Automatically releases funds to freelancer if client is silent beyond reviewWindow.
    function autoRelease(uint256 gigId, uint256 i) external whenNotPaused nonReentrant {
        Gig storage gig = gigs[gigId];
        if (gig.status != GigStatus.Active) revert InvalidGigStatus(GigStatus.Active, gig.status);
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();

        Milestone storage m = milestones[gigId][i];
        if (m.status != MStatus.Submitted) {
            revert InvalidMilestoneStatus(MStatus.Submitted, m.status);
        }

        if (block.timestamp < m.submittedAt + gig.reviewWindow) {
            revert ReviewWindowNotPassed();
        }

        m.status = MStatus.AutoReleased;
        uint96 amount = m.amount;

        totalLockedMilestoneFunds -= amount;
        totalWithdrawableFunds += amount;
        withdrawable[gig.freelancer] += amount;

        emit MilestoneAutoReleased(gigId, i, amount);

        _checkGigCompletion(gigId, 5, m.evidenceCID);
    }

    /// @notice Freelancer raises dispute following a rejection.
    function raiseDispute(uint256 gigId, uint256 i) external whenNotPaused {
        Gig storage gig = gigs[gigId];
        if (msg.sender != gig.freelancer) revert NotGigFreelancer();
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();

        Milestone storage m = milestones[gigId][i];
        if (m.status != MStatus.Rejected) {
            revert InvalidMilestoneStatus(MStatus.Rejected, m.status);
        }

        m.status = MStatus.Disputed;
        emit MilestoneDisputed(gigId, i);
    }

    /// @notice Arbiter resolves dispute with percentage basis points for freelancer (bps <= 10000).
    function resolveDispute(
        uint256 gigId,
        uint256 i,
        uint16 freelancerBps,
        string calldata rulingCID
    ) external onlyRole(ARBITER_ROLE) whenNotPaused nonReentrant {
        if (freelancerBps > 10000) revert InvalidDisputeSplit();
        Gig storage gig = gigs[gigId];
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();

        Milestone storage m = milestones[gigId][i];
        if (m.status != MStatus.Disputed) {
            revert InvalidMilestoneStatus(MStatus.Disputed, m.status);
        }

        m.status = MStatus.Resolved;
        uint96 amount = m.amount;

        uint256 freelancerShare = (uint256(amount) * freelancerBps) / 10000;
        uint256 clientShare = uint256(amount) - freelancerShare;

        totalLockedMilestoneFunds -= amount;
        totalWithdrawableFunds += amount;

        withdrawable[gig.freelancer] += freelancerShare;
        withdrawable[gig.client] += clientShare;

        emit MilestoneResolved(gigId, i, freelancerBps, rulingCID);

        _checkGigCompletion(gigId, 3, m.evidenceCID);
    }

    /// @notice Propose deadline extension/change by either party.
    function proposeDeadline(
        uint256 gigId,
        uint256 i,
        uint64 newDeadline
    ) external whenNotPaused {
        Gig storage gig = gigs[gigId];
        if (msg.sender != gig.client && msg.sender != gig.freelancer) revert Unauthorized();
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();

        DeadlineProposal storage prop = deadlineProposals[gigId][i];
        if (prop.pending) revert ProposalAlreadyPending();

        deadlineProposals[gigId][i] = DeadlineProposal({
            newDeadline: newDeadline,
            proposedBy: msg.sender,
            pending: true
        });

        emit DeadlineProposed(gigId, i, newDeadline, msg.sender);
    }

    /// @notice Accept the deadline proposal by the counterparty.
    function acceptDeadline(uint256 gigId, uint256 i) external whenNotPaused {
        Gig storage gig = gigs[gigId];
        if (msg.sender != gig.client && msg.sender != gig.freelancer) revert Unauthorized();
        if (i >= gig.milestoneCount) revert InvalidMilestoneIndex();

        DeadlineProposal storage prop = deadlineProposals[gigId][i];
        if (!prop.pending) revert NoPendingProposal();
        if (prop.proposedBy == msg.sender) revert CannotAcceptOwnProposal();

        uint64 approvedDeadline = prop.newDeadline;
        milestones[gigId][i].deadline = approvedDeadline;
        delete deadlineProposals[gigId][i];

        emit DeadlineAccepted(gigId, i, approvedDeadline);
    }

    /// @notice Pull payment pattern: users withdraw accumulated balances.
    function withdraw() external nonReentrant {
        uint256 amount = withdrawable[msg.sender];
        if (amount == 0) revert NoWithdrawableFunds();

        withdrawable[msg.sender] = 0;
        totalWithdrawableFunds -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ZentrixEscrow: transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    function _checkGigCompletion(uint256 gigId, uint8 finalRating, string memory lastEvidenceCID) internal {
        Gig storage gig = gigs[gigId];
        bool allDone = true;
        for (uint256 j = 0; j < gig.milestoneCount; j++) {
            MStatus s = milestones[gigId][j].status;
            if (s != MStatus.Approved && s != MStatus.AutoReleased && s != MStatus.Resolved) {
                allDone = false;
                break;
            }
        }

        if (allDone && gig.status == GigStatus.Active) {
            gig.status = GigStatus.Completed;
            emit GigCompleted(gigId, gig.freelancer);

            if (address(reputationContract) != address(0)) {
                try reputationContract.mintReputation(
                    gig.freelancer,
                    gigId,
                    finalRating > 0 ? finalRating : 5,
                    lastEvidenceCID
                ) {} catch {}
            }
        }
    }

    function getMilestones(uint256 gigId) external view returns (Milestone[] memory) {
        Gig storage gig = gigs[gigId];
        Milestone[] memory list = new Milestone[](gig.milestoneCount);
        for (uint256 i = 0; i < gig.milestoneCount; i++) {
            list[i] = milestones[gigId][i];
        }
        return list;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
