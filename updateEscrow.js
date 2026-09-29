const fs = require('fs');
let content = fs.readFileSync('contracts/contracts/ZentrixEscrow.sol', 'utf8');

const old_createGig = `    function createGig(
        string calldata metadataCID,
        MilestonePlan[] calldata plan,
        uint64 reviewWindow
    ) external whenNotPaused returns (uint256 gigId) {
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

        emit GigCreated(gigId, msg.sender, reviewWindow, totalBudget);
    }`;

const new_createGig = `    function createGig(
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
    }`;

content = content.replace(old_createGig, new_createGig);

const old_assignAndFund = `    function assignAndFund(
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

const new_assignAndFund = `    function assignAndFund(
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

content = content.replace(old_assignAndFund, new_assignAndFund);

fs.writeFileSync('contracts/contracts/ZentrixEscrow.sol', content);
