const fs = require('fs');

function updateDashboard() {
  let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

  if (!content.includes('import { ethers }')) {
    content = content.replace(
      'import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";',
      'import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";\nimport { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "../contracts";\nimport { ethers } from "ethers";'
    );
  }

  const oldSubmit = `  const handleSubmitForReview = (num: number) => {
    setMilestoneNotice(null);
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.num === num) {
          // Hard Invariant: once approved, status cannot be changed
          if (m.status === "approved") return m;
          return {
            ...m,
            status: "review",
            submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        }
        return m;
      })
    );
    setMilestoneNotice({
      type: "success",
      message: \`Milestone #\${num} deliverable submitted for review! Mentor / Client notified for approval.\`,
    });
  };`;

  const newSubmit = `  const handleSubmitForReview = async (num: number) => {
    setMilestoneNotice(null);
    try {
      if (!signer) throw new Error("Wallet not connected");
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.escrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      
      setMilestoneNotice({ type: "success", message: "Transaction pending on MST Testnet..." });
      const tx = await escrow.submitMilestone(
        1, // mock gigId since we rely on localStorage
        num - 1, // index
        "QmMockedEvidenceCID"
      );
      await tx.wait();

      setMilestones((prev) =>
        prev.map((m) => {
          if (m.num === num) {
            if (m.status === "approved") return m;
            return {
              ...m,
              status: "review",
              submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
          }
          return m;
        })
      );
      setMilestoneNotice({ type: "success", message: \`Milestone #\${num} deliverable anchored on-chain!\` });
    } catch(err: any) {
      setMilestoneNotice({ type: "error", message: err.message || "Transaction failed" });
    }
  };`;
  
  if(content.includes(oldSubmit)) {
      content = content.replace(oldSubmit, newSubmit);
  }

  const oldApprove = `  const handleApproveMilestone = (num: number) => {
    setMilestoneNotice(null);
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.num === num) {
          // Hard Invariant: once approved, status cannot be changed
          if (m.status === "approved") return m;
          return {
            ...m,
            status: "approved",
            approvedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        }
        return m;
      })
    );
    setMilestoneNotice({
      type: "success",
      message: \`Milestone #\${num} approved! Funds successfully released via smart contract.\`,
    });
    setMetrics((prev) => ({
      ...prev,
      escrowLocked: (parseFloat(prev.escrowLocked) - 2.5).toFixed(1),
    }));
  };`;

  const newApprove = `  const handleApproveMilestone = async (num: number) => {
    setMilestoneNotice(null);
    try {
      if (!signer) throw new Error("Wallet not connected");
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.escrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      
      setMilestoneNotice({ type: "success", message: "Transaction pending on MST Testnet..." });
      const tx = await escrow.approveMilestone(
        1, // mock gigId
        num - 1, // index
        5 // rating out of 5
      );
      await tx.wait();

      setMilestones((prev) =>
        prev.map((m) => {
          if (m.num === num) {
            if (m.status === "approved") return m;
            return {
              ...m,
              status: "approved",
              approvedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
          }
          return m;
        })
      );
      setMilestoneNotice({ type: "success", message: \`Milestone #\${num} approved! Funds released on-chain!\` });
      setMetrics((prev) => ({
        ...prev,
        escrowLocked: (parseFloat(prev.escrowLocked) - 2.5).toFixed(1),
      }));
    } catch(err: any) {
      setMilestoneNotice({ type: "error", message: err.message || "Transaction failed" });
    }
  };`;

  if(content.includes(oldApprove)) {
      content = content.replace(oldApprove, newApprove);
  }

  fs.writeFileSync('src/pages/Dashboard.tsx', content);
}

function updateMarketplace() {
  let content = fs.readFileSync('src/pages/Marketplace.tsx', 'utf8');

  if (!content.includes('import { ethers }')) {
    content = content.replace(
      'import { EscrowFlowInfographic } from "../components/EscrowFlowInfographic";',
      'import { EscrowFlowInfographic } from "../components/EscrowFlowInfographic";\nimport { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "../contracts";\nimport { ethers } from "ethers";'
    );
  }

  const oldCreate = `  const handleCreateGig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      openConnectModal();
      return;
    }

    const total = newMilestones.reduce((acc, m) => acc + parseFloat(m.amount || "0"), 0).toFixed(1);

    const created: GigItem = {
      id: (gigs.length + 1).toString(),
      title: newTitle,
      description: newDesc,
      client: address,
      totalBudget: total,
      reviewWindowHours: 72,
      category: newCategory.includes("Dev") ? "Development" : newCategory.includes("Design") ? "Design" : newCategory.includes("Content") ? "Content" : newCategory.includes("AI") ? "AI" : "Growth",
      tags: newSelectedTags,
      technologies: newSelectedTags.slice(0, 3),
      status: "Open",
      milestones: newMilestones,
    };

    setGigs([created, ...gigs]);
    setIsCreateModalOpen(false);
    setNewTitle("");
    setNewDesc("");
    setActionFeedback({
      type: "success",
      msg: \`Gig "\${created.title}" created! Milestones ready for on-chain Escrow assignment on MST Testnet.\`,
    });
    setTimeout(() => setActionFeedback(null), 5000);
  };`;

  const newCreate = `  const handleCreateGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !signer) {
      openConnectModal();
      return;
    }

    const total = newMilestones.reduce((acc, m) => acc + parseFloat(m.amount || "0"), 0).toFixed(1);
    setIsLoadingTransaction(true);
    setActionFeedback(null);

    try {
      const escrowContract = new ethers.Contract(CONTRACT_ADDRESSES.escrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const plan = newMilestones.map(m => ({
        amount: ethers.parseEther(m.amount || "0"),
        deadline: 0,
        criteriaHash: ethers.ZeroHash
      }));
      
      const tx = await escrowContract.createGig("QmMocked", plan, 72*3600, {
        value: ethers.parseEther(total)
      });
      await tx.wait();

      const created: GigItem = {
        id: (gigs.length + 1).toString(),
        title: newTitle,
        description: newDesc,
        client: address,
        totalBudget: total,
        reviewWindowHours: 72,
        category: newCategory.includes("Dev") ? "Development" : newCategory.includes("Design") ? "Design" : newCategory.includes("Content") ? "Content" : newCategory.includes("AI") ? "AI" : "Growth",
        tags: newSelectedTags,
        technologies: newSelectedTags.slice(0, 3),
        status: "Open",
        milestones: newMilestones,
      };

      setGigs([created, ...gigs]);
      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      setActionFeedback({
        type: "success",
        msg: \`Gig "\${created.title}" funded & created! MST Tokens locked in Escrow on MST Testnet.\`,
      });
      setTimeout(() => setActionFeedback(null), 5000);
    } catch(err: any) {
      setActionFeedback({ type: "error", msg: err.message || "Transaction failed" });
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setIsLoadingTransaction(false);
    }
  };`;

  if(content.includes(oldCreate)) {
      content = content.replace(oldCreate, newCreate);
  }

  const oldAccept = `  const handleAcceptProposal = (gigId: string, proposal: ProposalItem) => {
    const targetGig = gigs.find((g) => g.id === gigId);
    if (!targetGig) return;

    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + new Date().toLocaleDateString();

    const updatedGigs = gigs.map((g) => {
      if (g.id === gigId) {
        const updatedProposals = (g.proposals || []).map((p) => {
          if (p.id === proposal.id) {
            return { ...p, status: "Accepted" as const };
          }
          return p;
        });

        return {
          ...g,
          status: "Active" as const,
          assignedFreelancer: proposal.freelancerAddress,
          freelancer: proposal.freelancerAddress,
          acceptedAt: nowStr,
          proposals: updatedProposals,
        };
      }
      return g;
    });

    setGigs(updatedGigs);

    // Sync milestones into localStorage for Dashboard
    if (targetGig.milestones) {
      const dbMilestones = targetGig.milestones.map((m, i) => ({
        num: i + 1,
        title: m.title,
        amount: m.amount,
        status: "pending",
        deadlineDays: m.deadlineDays
      }));
      localStorage.setItem(\`zx_gig_\${gigId}_milestones\`, JSON.stringify(dbMilestones));
      window.dispatchEvent(new Event("zx_milestones_updated"));
    }

    setActionFeedback({
      type: "success",
      msg: \`Escrow Agreement initialized with \${proposal.freelancerName || "Freelancer"}. Milestones are now tracked on MST Testnet.\`,
    });
    setTimeout(() => setActionFeedback(null), 5000);
  };`;

  const newAccept = `  const handleAcceptProposal = async (gigId: string, proposal: ProposalItem) => {
    const targetGig = gigs.find((g) => g.id === gigId);
    if (!targetGig) return;

    if (!signer) {
      openConnectModal();
      return;
    }

    setIsLoadingTransaction(true);
    setActionFeedback(null);

    try {
      const escrowContract = new ethers.Contract(CONTRACT_ADDRESSES.escrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const tx = await escrowContract.assignAndFund(1, proposal.freelancerAddress, ethers.ZeroHash, "QmAgreement"); // hardcode gig 1
      await tx.wait();

      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + new Date().toLocaleDateString();

      const updatedGigs = gigs.map((g) => {
        if (g.id === gigId) {
          const updatedProposals = (g.proposals || []).map((p) => {
            if (p.id === proposal.id) {
              return { ...p, status: "Accepted" as const };
            }
            return p;
          });

          return {
            ...g,
            status: "Active" as const,
            assignedFreelancer: proposal.freelancerAddress,
            freelancer: proposal.freelancerAddress,
            acceptedAt: nowStr,
            proposals: updatedProposals,
          };
        }
        return g;
      });

      setGigs(updatedGigs);

      // Sync milestones into localStorage for Dashboard
      if (targetGig.milestones) {
        const dbMilestones = targetGig.milestones.map((m, i) => ({
          num: i + 1,
          title: m.title,
          amount: m.amount,
          status: "pending",
          deadlineDays: m.deadlineDays
        }));
        localStorage.setItem(\`zx_gig_\${gigId}_milestones\`, JSON.stringify(dbMilestones));
        window.dispatchEvent(new Event("zx_milestones_updated"));
      }

      setActionFeedback({
        type: "success",
        msg: \`Escrow Agreement initialized with \${proposal.freelancerName || "Freelancer"}. Freelancer assigned on MST Testnet.\`,
      });
    } catch(err: any) {
      setActionFeedback({ type: "error", msg: err.message || "Transaction failed" });
    } finally {
      setIsLoadingTransaction(false);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };`;

  if(content.includes(oldAccept)) {
      content = content.replace(oldAccept, newAccept);
  } else {
      console.log('Accept not found');
  }

  // Find the exact line to add isLoadingTransaction state
  if (!content.includes('isLoadingTransaction')) {
     const hookStr = `  const [gigs, setGigs] = useState<GigItem[]>(MOCK_GIGS);`;
     const newHookStr = `  const [gigs, setGigs] = useState<GigItem[]>(MOCK_GIGS);\n  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false);`;
     content = content.replace(hookStr, newHookStr);
  }

  // Destructure signer
  if (content.includes('const { address, openConnectModal } = useWallet();')) {
     content = content.replace('const { address, openConnectModal } = useWallet();', 'const { address, openConnectModal, signer } = useWallet();');
  }

  fs.writeFileSync('src/pages/Marketplace.tsx', content);
}

updateDashboard();
updateMarketplace();
