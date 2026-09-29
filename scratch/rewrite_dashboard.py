import os

def rewrite_dashboard():
    with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    if 'import { rtdb }' not in content:
        content = content.replace(
            'import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";',
            'import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";\nimport { rtdb } from "../lib/firebase";\nimport { ref, onValue, set, get, update } from "firebase/database";'
        )

    # ActiveTab state
    content = content.replace(
        'const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "reputation">("overview");',
        'const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "reputation" | "proposals">("overview");\n  const [clientGigs, setClientGigs] = useState<any[]>([]);'
    )

    # Tabs display
    content = content.replace(
        '(["overview", "milestones", "reputation"] as const).map((tab)',
        '(["overview", "milestones", "reputation", ...(currentRole === "client" ? ["proposals"] as const : [])] as const).map((tab)'
    )

    # Effect for proposals
    proposals_effect = """  useEffect(() => {
    if (activeTab === "proposals" && address && currentRole === "client") {
      const gigsRef = ref(rtdb, 'gigs');
      const unsubscribe = onValue(gigsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const myGigs = Object.values(data).filter((g: any) => g.client?.toLowerCase() === address.toLowerCase());
          setClientGigs(myGigs);
        }
      });
      return () => unsubscribe();
    }
  }, [activeTab, address, currentRole]);

  const handleAssign = async (gigId: string, freelancerAddress: string) => {
    if (!signer) return;
    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      // Ensure gigId is a number or parseable. Assuming onChainGigId is an integer string
      const tx = await escrow.assignAndFund(parseInt(gigId) || 1, freelancerAddress, ethers.ZeroHash, "");
      await tx.wait();
      
      await update(ref(rtdb, `gigs/${gigId}`), { status: 'Assigned', freelancer: freelancerAddress });
      alert("Freelancer Assigned Successfully!");
    } catch(e: any) {
      alert("Error: " + e.message);
    }
  };
"""

    content = content.replace(
        '  // ── Fetch on-chain data ─────────────────────────────────────────',
        proposals_effect + '\n  // ── Fetch on-chain data ─────────────────────────────────────────'
    )

    # Proposals tab render
    proposals_render = """
          {/* Proposals tab */}
          {activeTab === "proposals" && currentRole === "client" && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg" style={{ color: "var(--zx-ink)" }}>Received Proposals</h3>
              {clientGigs.length === 0 ? (
                <p className="text-sm text-gray-500">No gigs found for your address.</p>
              ) : (
                clientGigs.map((gig: any) => {
                  const proposals = gig.proposals ? Object.values(gig.proposals) : [];
                  return (
                    <div key={gig.id} className="p-4 rounded-2xl border" style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}>
                      <h4 className="font-bold mb-2">{gig.title}</h4>
                      {proposals.length === 0 ? (
                        <p className="text-xs text-gray-500">No proposals yet.</p>
                      ) : (
                        <div className="space-y-3 mt-3">
                          {proposals.map((prop: any) => (
                            <div key={prop.freelancerAddress} className="p-3 bg-white rounded-xl border flex justify-between items-center">
                              <div>
                                <p className="text-xs font-mono mb-1">{prop.freelancerAddress}</p>
                                <p className="text-sm text-gray-700">{prop.proposalText || prop.pitch}</p>
                              </div>
                              <button 
                                onClick={() => handleAssign(gig.id, prop.freelancerAddress)}
                                disabled={gig.status === "Assigned" || gig.status === "Active"}
                                className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold ${gig.status === "Assigned" || gig.status === "Active" ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
                              >
                                {gig.status === "Assigned" || gig.status === "Active" ? "Assigned" : "Assign"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
"""

    content = content.replace(
        '          {/* Milestones tab */}',
        proposals_render + '\n          {/* Milestones tab */}'
    )

    with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

rewrite_dashboard()
