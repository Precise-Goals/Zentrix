import os
import re

def rewrite_marketplace():
    with open('src/pages/Marketplace.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Imports
    if "from \"../lib/firebase\"" not in content:
        content = content.replace(
            'import { FREELANCE_CATEGORIES, ALL_FREELANCE_TAGS } from "../lib/tags";',
            'import { FREELANCE_CATEGORIES, ALL_FREELANCE_TAGS } from "../lib/tags";\nimport { rtdb } from "../lib/firebase";\nimport { ref, onValue, set, get, update } from "firebase/database";'
        )

    # 2. gigs state & useEffect
    gigs_state = """  const [gigs, setGigs] = useState<GigItem[]>(() => {
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
  }, [gigs]);"""

    new_gigs_state = """  const [gigs, setGigs] = useState<GigItem[]>([]);

  useEffect(() => {
    const gigsRef = ref(rtdb, 'gigs');
    const unsubscribe = onValue(gigsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert to array and merge proposals if they exist as an object
        const loadedGigs = Object.values(data).map((g: any) => {
          if (g.proposals && !Array.isArray(g.proposals)) {
             g.proposals = Object.values(g.proposals);
          }
          return g;
        }) as GigItem[];
        // Sort by id descending
        loadedGigs.sort((a, b) => {
           const idA = parseInt(a.id);
           const idB = parseInt(b.id);
           if (!isNaN(idA) && !isNaN(idB)) return idB - idA;
           return a.id.localeCompare(b.id);
        });
        setGigs(loadedGigs);
      } else {
        setGigs(INITIAL_GIGS);
      }
    });
    return () => unsubscribe();
  }, []);"""

    content = content.replace(gigs_state, new_gigs_state)
    
    # 3. handleCreateGig
    handle_create_gig_search = """      const tx = await escrow.createGig("QmMocked", plan, 72 * 3600, { value: totalBudgetWei });
      await tx.wait();

      const created: GigItem = {
        id: (gigs.length + 1).toString(),"""
    
    handle_create_gig_replace = """      const tx = await escrow.createGig("QmMocked", plan, 72 * 3600, { value: totalBudgetWei });
      const receipt = await tx.wait();
      
      let onChainGigId = Date.now().toString();
      try {
        if (receipt.logs) {
           for (const log of receipt.logs) {
              try {
                const parsed = escrow.interface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed?.name === "GigCreated") {
                   onChainGigId = parsed.args[0].toString();
                }
              } catch (e) {}
           }
        }
      } catch(e) {}

      const created: GigItem = {
        id: onChainGigId,"""

    content = content.replace(handle_create_gig_search, handle_create_gig_replace)
    
    # 4. Save to RTDB in handleCreateGig
    save_to_rtdb_search = """      setGigs([created, ...gigs]);
      setIsCreateModalOpen(false);"""
      
    save_to_rtdb_replace = """      await set(ref(rtdb, `gigs/${onChainGigId}`), created);
      setIsCreateModalOpen(false);"""

    content = content.replace(save_to_rtdb_search, save_to_rtdb_replace)
    
    # 5. submitApplication
    submit_application_search = """    const updatedGigs = gigs.map((g) => {
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

    setGigs(updatedGigs);"""
    
    submit_application_replace = """    set(ref(rtdb, `gigs/${activeGig.id}/proposals/${address}`), newProposal);
    update(ref(rtdb, `gigs/${activeGig.id}`), { status: activeGig.status === "Active" ? activeGig.status : "Submitted" });"""
    
    content = content.replace(submit_application_search, submit_application_replace)

    # 6. Apply button replace - activeGig view
    apply_btn_search = """                {isActive ? (
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
                )}"""
                
    apply_btn_replace = """                {isActive ? (
                  <Link to="/dashboard" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs" style={{ background: "var(--zx-success)" }}>
                    <span>Work Started</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : isOwner ? (
                  <button disabled className="btn-secondary text-xs py-1.5 px-4 shadow-xs opacity-50 cursor-not-allowed">
                    Your Gig
                  </button>
                ) : isApplicant ? (
                  <button disabled className="btn-secondary text-xs py-1.5 px-3 opacity-80 cursor-not-allowed flex items-center gap-1 font-bold" title="Application is locked as Submitted.">
                    <Lock className="w-3 h-3" />
                    <span>Submitted</span>
                  </button>
                ) : (
                  <button onClick={() => handleApply(gig)} className="btn-primary text-xs py-1.5 px-4 shadow-xs">
                    Apply
                  </button>
                )}"""
                
    content = content.replace(apply_btn_search, apply_btn_replace)
    
    # 7. Apply button inside the activeGig Modal
    apply_modal_search = """            {/* Bottom Info / Sticky Actions */}
            <div className="pt-4 mt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--zx-border)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--zx-muted)" }}>
                Funding Protected by ZentrixEscrow 
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                {activeGig.status === "Active" ? (
                  <Link to="/dashboard" className="btn-primary flex-1 sm:flex-none justify-center" style={{ background: "var(--zx-success)" }}>
                    View Work in Dashboard
                  </Link>
                ) : activeGig.proposals?.find(p => p.freelancerAddress.toLowerCase() === address?.toLowerCase()) ? (
                  <button disabled className="btn-secondary flex-1 sm:flex-none justify-center opacity-80 cursor-not-allowed flex items-center gap-1 font-bold">
                    <Lock className="w-4 h-4" /> Application Submitted
                  </button>
                ) : (
                  <button onClick={() => handleApply(activeGig)} className="btn-primary flex-1 sm:flex-none justify-center">
                    Submit Proposal
                  </button>
                )}
              </div>
            </div>"""
            
    apply_modal_replace = """            {/* Bottom Info / Sticky Actions */}
            <div className="pt-4 mt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--zx-border)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--zx-muted)" }}>
                Funding Protected by ZentrixEscrow 
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                {activeGig.status === "Active" ? (
                  <Link to="/dashboard" className="btn-primary flex-1 sm:flex-none justify-center" style={{ background: "var(--zx-success)" }}>
                    View Work in Dashboard
                  </Link>
                ) : address && activeGig.client.toLowerCase() === address.toLowerCase() ? (
                  <button disabled className="btn-secondary flex-1 sm:flex-none justify-center opacity-50 cursor-not-allowed">
                    Your Gig
                  </button>
                ) : activeGig.proposals?.find(p => p.freelancerAddress.toLowerCase() === address?.toLowerCase()) ? (
                  <button disabled className="btn-secondary flex-1 sm:flex-none justify-center opacity-80 cursor-not-allowed flex items-center gap-1 font-bold">
                    <Lock className="w-4 h-4" /> Application Submitted
                  </button>
                ) : (
                  <button onClick={() => handleApply(activeGig)} className="btn-primary flex-1 sm:flex-none justify-center">
                    Submit Proposal
                  </button>
                )}
              </div>
            </div>"""
            
    content = content.replace(apply_modal_search, apply_modal_replace)

    with open('src/pages/Marketplace.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

rewrite_marketplace()
