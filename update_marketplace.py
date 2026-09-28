import sys

with open('src/pages/Marketplace.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State initialization
old_state = '''  const [gigs, setGigs] = useState<GigItem[]>(INITIAL_GIGS);'''
new_state = '''  const [gigs, setGigs] = useState<GigItem[]>(() => {
    try {
      const saved = localStorage.getItem("zx_marketplace_gigs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return INITIAL_GIGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("zx_marketplace_gigs", JSON.stringify(gigs));
    } catch (_) {}
  }, [gigs]);'''
content = content.replace(old_state, new_state)

# 2. Extract profile and user
old_auth = '''  const { currentRole } = useAuth();'''
new_auth = '''  const { currentRole, profile, user } = useAuth();'''
content = content.replace(old_auth, new_auth)

# 3. submitApplication rewrite
old_submit = '''  const submitApplication = () => {
    setIsApplyModalOpen(false);
    setApplyProposal("");
    setActionFeedback({
      type: "success",
      msg: "Application proposal submitted! Client can now review milestones and assign your address in ZentrixEscrow.",
    });
  };'''

new_submit = '''  const submitApplication = () => {
    if (!activeGig || !address) {
      if (!isConnected) openConnectModal();
      return;
    }
    if (!applyProposal.trim()) {
      setActionFeedback({
        type: "error",
        msg: "Please provide your proposed delivery approach before submitting.",
      });
      return;
    }

    const newProposal: ProposalItem = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      freelancerAddress: address.toLowerCase(),
      freelancerName: profile?.name || user?.displayName || `Freelancer (${address.slice(0, 6)}...${address.slice(-4)})`,
      proposalText: applyProposal.trim(),
      submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + new Date().toLocaleDateString(),
      status: "Submitted",
    };

    const updatedGigs = gigs.map((g) => {
      if (g.id === activeGig.id) {
        const existingProposals = g.proposals || [];
        const filtered = existingProposals.filter((p) => p.freelancerAddress.toLowerCase() !== address.toLowerCase());
        return {
          ...g,
          status: g.status === "Active" ? g.status : ("Submitted" as const),
          proposals: [...filtered, newProposal],
        };
      }
      return g;
    });

    setGigs(updatedGigs);
    setIsApplyModalOpen(false);
    setApplyProposal("");
    setActiveGig(null);
    setActionFeedback({
      type: "success",
      msg: `Application proposal locked & submitted for "${activeGig.title}"! Client has been notified to review your terms.`,
    });
  };

  const handleAcceptProposal = (gigId: string, proposal: ProposalItem) => {
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
    try {
      const savedMilestonesRaw = localStorage.getItem("zx_dashboard_milestones");
      let currentMilestones: any[] = [];
      if (savedMilestonesRaw) {
        currentMilestones = JSON.parse(savedMilestonesRaw);
      }

      const existingTitles = new Set(currentMilestones.map((m: any) => m.label));
      const newItems = targetGig.milestones
        .filter((m) => !existingTitles.has(`${targetGig.title} — ${m.title}`))
        .map((m, idx) => ({
          id: Date.now() + idx,
          num: currentMilestones.length + idx + 1,
          label: `${targetGig.title} — ${m.title}`,
          amount: m.amount,
          description: m.acceptanceCriteria,
          status: "pending",
          gigId: targetGig.id,
          freelancerAddress: proposal.freelancerAddress,
        }));

      if (newItems.length > 0) {
        const combined = [...currentMilestones, ...newItems];
        localStorage.setItem("zx_dashboard_milestones", JSON.stringify(combined));
        window.dispatchEvent(new Event("zx_milestones_updated"));
      }
    } catch (err) {
      console.error("Failed to sync milestones to dashboard", err);
    }

    // Update activeGig modal view
    const refreshedGig = updatedGigs.find((g) => g.id === gigId);
    if (refreshedGig) {
      setActiveGig(refreshedGig);
    }

    setActionFeedback({
      type: "success",
      msg: `Proposal accepted! Work has officially started for "${targetGig.title}". Milestones are locked in Escrow on MST Testnet.`,
    });
  };'''
content = content.replace(old_submit, new_submit)

# 4. Update the Card rendering
old_card_map_start = '''        {filteredGigs.map((gig) => (
          <div
            key={gig.id}
            className="rounded-3xl p-6 flex flex-col justify-between space-y-4 transition-all hover:scale-[1.01] hover:shadow-lg"'''

new_card_map_start = '''        {filteredGigs.map((gig) => {
          const isActive = gig.status === "Active";
          const isOwner = !!address && (gig.client.toLowerCase() === address.toLowerCase());
          const userProposal = address ? gig.proposals?.find(p => p.freelancerAddress.toLowerCase() === address.toLowerCase()) : null;
          const isApplicant = !!userProposal;
          const proposalCount = gig.proposals?.length || 0;
          
          return (
          <div
            key={gig.id}
            className="rounded-3xl p-6 flex flex-col justify-between space-y-4 transition-all hover:scale-[1.01] hover:shadow-lg"'''
content = content.replace(old_card_map_start, new_card_map_start)

# Update Status Badge on Card
old_status_badge = '''                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: "color-mix(in srgb, var(--zx-success) 15%, transparent)", color: "var(--zx-success)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--zx-success)" }} />
                  {gig.status}
                </span>'''

new_status_badge = '''                {isActive ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5" style={{ background: "color-mix(in srgb, var(--zx-success) 18%, transparent)", color: "var(--zx-success)" }}>
                    <span className="w-2 h-2 rounded-full animate-ping" style={{ background: "var(--zx-success)" }} />
                    Active · Work Started
                  </span>
                ) : isApplicant ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(217, 119, 6, 0.15)", color: "var(--zx-warning)" }}>
                    <Lock className="w-3 h-3" />
                    Submitted (Locked)
                  </span>
                ) : proposalCount > 0 ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: "color-mix(in srgb, var(--zx-primary) 15%, transparent)", color: "var(--zx-primary)" }}>
                    <Sparkles className="w-3 h-3" />
                    {proposalCount} Proposal{proposalCount > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "color-mix(in srgb, var(--zx-success) 15%, transparent)", color: "var(--zx-success)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--zx-success)" }} />
                    Open
                  </span>
                )}'''
content = content.replace(old_status_badge, new_status_badge)

# Update Bottom Meta & Actions on Card
old_actions = '''              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveGig(gig)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Milestones
                </button>
                <button
                  onClick={() => handleApply(gig)}
                  className="btn-primary text-xs py-1.5 px-4 shadow-xs"
                >
                  Apply
                </button>
              </div>'''

new_actions = '''              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveGig(gig)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  {proposalCount > 0 && (isOwner || currentRole === "client") ? `Review (${proposalCount})` : "Milestones"}
                </button>
                
                {isActive ? (
                  <Link to="/dashboard" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs" style={{ background: "var(--zx-success)" }}>
                    <span>Work Started</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : isApplicant ? (
                  <button disabled className="btn-secondary text-xs py-1.5 px-3 opacity-80 cursor-not-allowed flex items-center gap-1 font-bold" title="Application is locked as Submitted.">
                    <Lock className="w-3 h-3" />
                    <span>Submitted</span>
                  </button>
                ) : (
                  <button onClick={() => handleApply(gig)} className="btn-primary text-xs py-1.5 px-4 shadow-xs">
                    Apply
                  </button>
                )}
              </div>'''
content = content.replace(old_actions, new_actions)

# Close the map block properly
old_map_close = '''          </div>
        ))}'''
new_map_close = '''          </div>
          );
        })}'''
content = content.replace(old_map_close, new_map_close)


# 5. Active Gig Modal Updates
old_total_locked = '''            {/* Total Budget & Proposal CTA */}
            <div
              className="p-4 rounded-2xl flex items-center justify-between"
              style={{ background: "var(--zx-surface-alt)" }}
            >
              <div>
                <span className="text-xs" style={{ color: "var(--zx-muted)" }}>Total Locked Escrow:</span>
                <span className="text-lg font-black font-mono ml-2" style={{ color: "var(--zx-primary-deep)" }}>
                  {activeGig.totalBudget} tMSTC
                </span>
              </div>
              <button
                onClick={() => {
                  const gig = activeGig;
                  setActiveGig(null);
                  handleApply(gig);
                }}
                className="btn-primary text-xs py-2.5 px-6 shadow-sm"
              >
                Submit Proposal
              </button>
            </div>'''

new_total_locked = '''            {/* Proposals Received & Review Section */}
            {activeGig.proposals && activeGig.proposals.length > 0 && (
              <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--zx-border)" }}>
                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--zx-ink)" }}>
                  <Users className="w-4 h-4" style={{ color: "var(--zx-primary-deep)" }} />
                  Received Proposals ({activeGig.proposals.length})
                </h4>
                <div className="space-y-3">
                  {activeGig.proposals.map((p) => (
                    <div key={p.id} className="p-4 rounded-2xl border space-y-3" style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: "var(--zx-surface-alt)", color: "var(--zx-primary-deep)" }}>
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold" style={{ color: "var(--zx-ink)" }}>{p.freelancerName}</div>
                            <div className="text-[10px] font-mono" style={{ color: "var(--zx-muted)" }}>{p.freelancerAddress}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px]" style={{ color: "var(--zx-muted)" }}>{p.submittedAt}</div>
                          {p.status === "Accepted" ? (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Accepted · Assigned</span>
                          ) : (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 justify-end">
                              <Lock className="w-3 h-3" /> Under Review
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs p-3 rounded-xl" style={{ background: "var(--zx-surface)", color: "var(--zx-ink)", border: "1px solid var(--zx-border)" }}>
                        {p.proposalText}
                      </div>
                      
                      {(currentRole === "client" || (address && activeGig.client.toLowerCase() === address.toLowerCase())) && p.status === "Submitted" && activeGig.status !== "Active" && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleAcceptProposal(activeGig.id, p)}
                            className="btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5 font-bold transition-transform hover:scale-105"
                            style={{ background: "var(--zx-success)" }}
                          >
                            <Check className="w-4 h-4" />
                            <span>Accept Proposal & Start Work</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total Budget & Proposal CTA */}
            <div
              className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4"
              style={{ background: "var(--zx-surface-alt)" }}
            >
              <div>
                <span className="text-xs" style={{ color: "var(--zx-muted)" }}>Total Locked Escrow:</span>
                <span className="text-lg font-black font-mono ml-2" style={{ color: "var(--zx-primary-deep)" }}>
                  {activeGig.totalBudget} tMSTC
                </span>
              </div>
              
              {activeGig.status === "Active" ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-800 bg-green-100 px-3 py-2 rounded-xl">
                    <CheckCircle className="w-4 h-4" /> Work Started
                  </div>
                  <Link to="/dashboard" className="btn-primary text-xs py-2 px-4 flex items-center gap-1" style={{ background: "var(--zx-success)" }}>
                    Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (address && activeGig.proposals?.some(p => p.freelancerAddress.toLowerCase() === address.toLowerCase())) ? (
                <button disabled className="btn-secondary text-xs py-2.5 px-6 opacity-75 cursor-not-allowed flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> Submitted (Locked)
                </button>
              ) : (currentRole === "client" || (address && activeGig.client.toLowerCase() === address.toLowerCase())) ? (
                <span className="text-xs font-bold" style={{ color: "var(--zx-muted)" }}>Awaiting Proposals</span>
              ) : (
                <button
                  onClick={() => {
                    const gig = activeGig;
                    setActiveGig(null);
                    handleApply(gig);
                  }}
                  className="btn-primary text-xs py-2.5 px-6 shadow-sm"
                >
                  Submit Proposal
                </button>
              )}
            </div>'''
content = content.replace(old_total_locked, new_total_locked)

if 'Users,' not in content:
    content = content.replace('User,', 'User, Users,')

with open('src/pages/Marketplace.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
