const fs = require('fs');

let content = fs.readFileSync('contracts/contracts/ZentrixEscrow.sol', 'utf8');

// Replace createGig
content = content.replace(
  '    function createGig(\n        string calldata metadataCID,\n        MilestonePlan[] calldata plan,\n        uint64 reviewWindow\n    ) external whenNotPaused returns (uint256 gigId) {',
  '    function createGig(\n        string calldata metadataCID,\n        MilestonePlan[] calldata plan,\n        uint64 reviewWindow\n    ) external payable whenNotPaused nonReentrant returns (uint256 gigId) {'
);

const oldGigCreate = `        gigs[gigId] = Gig({
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

        emit GigCreated(gigId, msg.sender, reviewWindow, totalBudget);
    }`;

const newGigCreate = `        if (msg.value != totalBudget) revert IncorrectFundingAmount(totalBudget, msg.value);

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
    }`;
content = content.replace(oldGigCreate, newGigCreate);


const oldAssign = `    function assignAndFund(
        uint256 gigId,
        address freelancer,
        bytes32 agreementHash,
        string calldata agreementCID
    ) external payable whenNotPaused nonReentrant {
        Gig storage gig = gigs[gigId];
        if (gig.client == address(0)) revert GigNotFound();
        if (msg.sender != gig.client) revert NotGigClient();
        if (gig.status != GigStatus.Open) revert InvalidGigStatus(GigStatus.Open, gig.status);
        if (freelancer == address(0)) revert ZeroAddress();

        uint256 totalRequired = 0;
        for (uint256 i = 0; i < gig.milestoneCount; i++) {
            totalRequired += milestones[gigId][i].amount;
        }

        if (msg.value != totalRequired) {
            revert IncorrectFundingAmount(totalRequired, msg.value);
        }

        gig.freelancer = freelancer;
        gig.status = GigStatus.Assigned;
        gig.assignedAt = uint64(block.timestamp);
        gig.agreementHash = agreementHash;
        gig.agreementCID = agreementCID;

        totalLockedMilestoneFunds += msg.value;

        emit Funded(gigId, msg.sender, freelancer, msg.value);
        emit AgreementSigned(gigId, msg.sender, agreementHash);
    }`;

const newAssign = `    function assignAndFund(
        uint256 gigId,
        address freelancer,
        bytes32 agreementHash,
        string calldata agreementCID
    ) external whenNotPaused {
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
    }`;

content = content.replace(oldAssign, newAssign);

fs.writeFileSync('contracts/contracts/ZentrixEscrow.sol', content);
