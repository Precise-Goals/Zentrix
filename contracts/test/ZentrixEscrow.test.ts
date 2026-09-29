import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ZentrixEscrow, ZentrixReputation } from "../typechain-types";

describe("ZentrixEscrow & ZentrixReputation", function () {
  let escrow: ZentrixEscrow;
  let reputation: ZentrixReputation;
  let owner: any;
  let arbiter: any;
  let client: any;
  let freelancer: any;
  let stranger: any;

  const REVIEW_WINDOW = 72 * 3600; // 72 hours
  const ACCEPTANCE_WINDOW = 48 * 3600; // 48 hours

  beforeEach(async function () {
    [owner, arbiter, client, freelancer, stranger] = await ethers.getSigners();

    const ReputationFactory = await ethers.getContractFactory("ZentrixReputation");
    reputation = await ReputationFactory.deploy();
    await reputation.waitForDeployment();

    const EscrowFactory = await ethers.getContractFactory("ZentrixEscrow");
    escrow = await EscrowFactory.deploy(arbiter.address, await reputation.getAddress());
    await escrow.waitForDeployment();

    // Grant MINTER_ROLE on Reputation to Escrow
    const MINTER_ROLE = await reputation.MINTER_ROLE();
    await reputation.grantRole(MINTER_ROLE, await escrow.getAddress());
  });

  describe("Gig Creation & Funding", function () {
    it("should allow a client to create a gig with a valid plan", async function () {
      const plan = [
        {
          amount: ethers.parseEther("1.0"),
          deadline: (await time.latest()) + 7 * 86400,
          criteriaHash: ethers.keccak256(ethers.toUtf8Bytes("Criteria M1")),
        },
        {
          amount: ethers.parseEther("2.0"),
          deadline: (await time.latest()) + 14 * 86400,
          criteriaHash: ethers.keccak256(ethers.toUtf8Bytes("Criteria M2")),
        },
      ];

      await expect(escrow.connect(client).createGig("ipfs://meta-1", plan, REVIEW_WINDOW, { value: ethers.parseEther("3.0") }))
        .to.emit(escrow, "GigCreated")
        .withArgs(1, client.address, REVIEW_WINDOW, ethers.parseEther("3.0"));

      const gig = await escrow.gigs(1);
      expect(gig.client).to.equal(client.address);
      expect(gig.status).to.equal(0); // Open
      expect(gig.milestoneCount).to.equal(2);
    });

    it("should revert funding if msg.value does not equal sum(plan)", async function () {
      const plan = [
        {
          amount: ethers.parseEther("1.0"),
          deadline: (await time.latest()) + 7 * 86400,
          criteriaHash: ethers.keccak256(ethers.toUtf8Bytes("Criteria M1")),
        },
      ];

      await expect(
        escrow.connect(client).createGig("ipfs://meta-1", plan, REVIEW_WINDOW, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(escrow, "IncorrectFundingAmount");
    });
  });

  describe("Lifecycle: Acceptance, Submission, Approval, Withdrawal", function () {
    beforeEach(async function () {
      const plan = [
        {
          amount: ethers.parseEther("1.0"),
          deadline: (await time.latest()) + 7 * 86400,
          criteriaHash: ethers.keccak256(ethers.toUtf8Bytes("Criteria 1")),
        },
      ];
      await escrow.connect(client).createGig("ipfs://meta", plan, REVIEW_WINDOW, { value: ethers.parseEther("1.0") });
      await escrow.connect(client).assignAndFund(
        1,
        freelancer.address,
        ethers.keccak256(ethers.toUtf8Bytes("doc")),
        "ipfs://agree"
      );
    });

    it("should complete golden path: accept -> submit -> approve -> withdraw", async function () {
      // Freelancer accepts
      await expect(escrow.connect(freelancer).acceptAssignment(1))
        .to.emit(escrow, "AgreementSigned");

      // Submit milestone
      await expect(escrow.connect(freelancer).submitMilestone(1, 0, "ipfs://evidence-1"))
        .to.emit(escrow, "MilestoneSubmitted");

      // Client approves and rates 5
      await expect(escrow.connect(client).approveMilestone(1, 0, 5))
        .to.emit(escrow, "MilestoneApproved")
        .to.emit(escrow, "GigCompleted");

      // Check withdrawable balance
      expect(await escrow.withdrawable(freelancer.address)).to.equal(ethers.parseEther("1.0"));

      // Freelancer withdraws
      const balBefore = await ethers.provider.getBalance(freelancer.address);
      const tx = await escrow.connect(freelancer).withdraw();
      const receipt = await tx.wait();
      const gasSpent = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(freelancer.address);

      expect(balAfter + gasSpent - balBefore).to.equal(ethers.parseEther("1.0"));
      expect(await escrow.withdrawable(freelancer.address)).to.equal(0n);

      // Verify reputation SBT was minted
      expect(await reputation.balanceOf(freelancer.address)).to.equal(1n);
      const [score, count] = await reputation.getReputationScore(freelancer.address);
      expect(score).to.equal(500n); // 5.00 * 100
      expect(count).to.equal(1n);
    });

    it("should allow client to cancel unaccepted gig after 48 hours", async function () {
      // Advance time beyond 48h
      await time.increase(ACCEPTANCE_WINDOW + 1);

      await expect(escrow.connect(client).cancelUnaccepted(1))
        .to.emit(escrow, "GigCancelled")
        .withArgs(1, ethers.parseEther("1.0"));

      expect(await escrow.withdrawable(client.address)).to.equal(ethers.parseEther("1.0"));
    });
  });

  describe("Dispute Resolution & Auto-Release", function () {
    beforeEach(async function () {
      const plan = [
        {
          amount: ethers.parseEther("2.0"),
          deadline: (await time.latest()) + 7 * 86400,
          criteriaHash: ethers.keccak256(ethers.toUtf8Bytes("Criteria M1")),
        },
      ];
      await escrow.connect(client).createGig("ipfs://meta", plan, REVIEW_WINDOW, { value: ethers.parseEther("2.0") });
      await escrow.connect(client).assignAndFund(
        1,
        freelancer.address,
        ethers.keccak256(ethers.toUtf8Bytes("doc")),
        "ipfs://agree"
      );
      await escrow.connect(freelancer).acceptAssignment(1);
      await escrow.connect(freelancer).submitMilestone(1, 0, "ipfs://evidence");
    });

    it("should auto-release milestone funds after reviewWindow expires", async function () {
      // Advance past review window
      await time.increase(REVIEW_WINDOW + 1);

      await expect(escrow.connect(freelancer).autoRelease(1, 0))
        .to.emit(escrow, "MilestoneAutoReleased")
        .withArgs(1, 0, ethers.parseEther("2.0"));

      expect(await escrow.withdrawable(freelancer.address)).to.equal(ethers.parseEther("2.0"));
    });

    it("should handle reject -> dispute -> arbiter split correctly", async function () {
      // Client rejects with reason
      await expect(escrow.connect(client).rejectMilestone(1, 0, "ipfs://reason-buggy"))
        .to.emit(escrow, "MilestoneRejected")
        .withArgs(1, 0, "ipfs://reason-buggy");

      // Freelancer raises dispute
      await expect(escrow.connect(freelancer).raiseDispute(1, 0))
        .to.emit(escrow, "MilestoneDisputed");

      // Non-arbiter cannot resolve
      await expect(
        escrow.connect(stranger).resolveDispute(1, 0, 5000, "ipfs://ruling")
      ).to.be.reverted;

      // Arbiter resolves: 60% (6000 bps) to freelancer, 40% to client
      await expect(
        escrow.connect(arbiter).resolveDispute(1, 0, 6000, "ipfs://ruling")
      )
        .to.emit(escrow, "MilestoneResolved")
        .withArgs(1, 0, 6000, "ipfs://ruling");

      // 60% of 2.0 = 1.2 tMSTC to freelancer, 0.8 tMSTC to client
      expect(await escrow.withdrawable(freelancer.address)).to.equal(ethers.parseEther("1.2"));
      expect(await escrow.withdrawable(client.address)).to.equal(ethers.parseEther("0.8"));
    });
  });

  describe("Deadline Negotiation", function () {
    it("should require proposal and mutual acceptance for deadline extension", async function () {
      const plan = [
        {
          amount: ethers.parseEther("1.0"),
          deadline: (await time.latest()) + 7 * 86400,
          criteriaHash: ethers.keccak256(ethers.toUtf8Bytes("Criteria M1")),
        },
      ];
      await escrow.connect(client).createGig("ipfs://meta", plan, REVIEW_WINDOW, { value: ethers.parseEther("1.0") });
      await escrow.connect(client).assignAndFund(
        1,
        freelancer.address,
        ethers.keccak256(ethers.toUtf8Bytes("doc")),
        "ipfs://agree"
      );
      await escrow.connect(freelancer).acceptAssignment(1);

      const newDeadline = (await time.latest()) + 20 * 86400;

      // Freelancer proposes
      await expect(escrow.connect(freelancer).proposeDeadline(1, 0, newDeadline))
        .to.emit(escrow, "DeadlineProposed")
        .withArgs(1, 0, newDeadline, freelancer.address);

      // Freelancer cannot accept own proposal
      await expect(
        escrow.connect(freelancer).acceptDeadline(1, 0)
      ).to.be.revertedWithCustomError(escrow, "CannotAcceptOwnProposal");

      // Client accepts
      await expect(escrow.connect(client).acceptDeadline(1, 0))
        .to.emit(escrow, "DeadlineAccepted")
        .withArgs(1, 0, newDeadline);

      const m = await escrow.milestones(1, 0);
      expect(m.deadline).to.equal(newDeadline);
    });
  });

  describe("Soulbound Tokens: Transfer Reversion", function () {
    it("should revert any transfer of Reputation NFT between users", async function () {
      const MINTER = await reputation.MINTER_ROLE();
      await reputation.grantRole(MINTER, owner.address);

      await reputation.mintReputation(freelancer.address, 1, 5, "ipfs://evidence");

      await expect(
        reputation.connect(freelancer).transferFrom(freelancer.address, stranger.address, 1)
      ).to.be.revertedWith("ZentrixReputation: soulbound, non-transferable");
    });
  });
});
