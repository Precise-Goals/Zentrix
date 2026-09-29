import os

def fix_onboarding():
    with open('src/pages/Onboarding.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Import walletType if not there
    if 'walletType' not in content and 'useWallet()' in content:
        content = content.replace(
            'const { address, isConnected, isCorrectNetwork, switchNetwork, openConnectModal, signMessage, connectWallet } = useWallet();',
            'const { address, isConnected, isCorrectNetwork, switchNetwork, openConnectModal, signMessage, connectWallet, walletType } = useWallet();'
        )

    # Ensure strictly BridgeKey
    bridgekey_check = """
                {isSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Successfully verified! Redirecting to your destination...</span>
                  </div>
                )}
"""
    new_bridgekey_check = """
                {isSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Successfully verified! Redirecting to your destination...</span>
                  </div>
                )}
                {isConnected && walletType !== "bridgekey" && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-mono flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>STRICT REQUIREMENT: You MUST connect via BridgeKey extension. Other wallets are not permitted.</span>
                  </div>
                )}
"""
    content = content.replace(bridgekey_check, new_bridgekey_check)

    button_check = """                ) : !isConnected ? (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>Connect MST Wallet</span>
                  </>
                ) : ("""
                
    new_button_check = """                ) : !isConnected || walletType !== "bridgekey" ? (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>Connect BridgeKey Wallet</span>
                  </>
                ) : ("""
    
    content = content.replace(button_check, new_button_check)

    # Handle handleWalletBinding check
    handle_binding = """  const handleWalletBinding = async () => {
    if (!isConnected || !address) {
      openConnectModal();
      return;
    }"""
    
    new_handle_binding = """  const handleWalletBinding = async () => {
    if (!isConnected || !address || walletType !== 'bridgekey') {
      openConnectModal();
      return;
    }"""
    
    content = content.replace(handle_binding, new_handle_binding)
    
    with open('src/pages/Onboarding.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

fix_onboarding()
