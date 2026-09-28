import { ethers, Contract } from "ethers";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, RPC_URL } from "../contracts";

export interface NFTScanResult {
  hasPass: boolean;
  passTier: number; // 0=None, 1=Pro, 2=Enterprise, 3=Architect
  passTokenId: string | null;
  passExpiresAt: number | null;
  passBalance: number;
  reputationCount: number;
  reputationTokenIds: string[];
  lastScannedAt: number;
}

const DEFAULT_RESULT: NFTScanResult = {
  hasPass: false,
  passTier: 0,
  passTokenId: null,
  passExpiresAt: null,
  passBalance: 0,
  reputationCount: 0,
  reputationTokenIds: [],
  lastScannedAt: 0,
};

/**
 * Synchronously retrieves cached NFT assets from localStorage
 * so that on page reload the UI renders existing minted NFTs instantly.
 */
export function getCachedNFTAssets(address?: string | null): NFTScanResult {
  if (!address || typeof window === "undefined") return DEFAULT_RESULT;
  try {
    const raw = localStorage.getItem(`zx_nft_cache_${address.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as NFTScanResult;
      }
    }
  } catch (_) {}
  return DEFAULT_RESULT;
}

/**
 * Deep scans the MST Testnet blockchain for all ERC-721 Pass and Reputation NFTs
 * owned by the given address, verifying balances, mappings, and Transfer events.
 */
export async function scanNFTAssets(
  address?: string | null,
  providerOverride?: any
): Promise<NFTScanResult> {
  if (!address) return DEFAULT_RESULT;

  const normalized = address.toLowerCase();
  let checksumAddress = address;
  try {
    checksumAddress = ethers.getAddress(address);
  } catch (_) {}

  // Fallback to public RPC provider if none provided
  const provider =
    providerOverride ?? new ethers.JsonRpcProvider(RPC_URL);

  const passContract = new Contract(
    CONTRACT_ADDRESSES.ZentrixPass,
    CONTRACT_ABIS.ZentrixPass,
    provider
  );

  const repContract = new Contract(
    CONTRACT_ADDRESSES.ZentrixReputation,
    CONTRACT_ABIS.ZentrixReputation,
    provider
  );

  let passBalance = 0;
  let passTier = 0;
  let passTokenId: string | null = null;
  let passExpiresAt: number | null = null;
  let reputationCount = 0;
  let reputationTokenIds: string[] = [];

  // 1. Scan ZentrixPass ERC-721
  try {
    const rawBal = await passContract.balanceOf(checksumAddress);
    passBalance = Number(rawBal);
  } catch {
    // passContract.balanceOf fallback
  }

  // 2. Query getPass() & tierOf()
  try {
    const passData = await passContract.getPass(checksumAddress);
    const tier = Number(passData.tier);
    const exp = Number(passData.expiresAt);
    const id = passData.tokenId.toString();

    if (tier > 0) passTier = tier;
    if (exp > 0) passExpiresAt = exp;
    if (id !== "0") passTokenId = id;
  } catch (_) {
    try {
      const rawTier = await passContract.tierOf(checksumAddress);
      const tier = Number(rawTier);
      if (tier > 0) passTier = tier;
    } catch (_) {}
  }

  // 3. If balance > 0 but tier is 0, query on-chain events to extract minted tier & tokenId
  if (passBalance > 0 && (passTier === 0 || !passTokenId)) {
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 20000);

      // Check PassPurchased events for buyer
      const pFilter = passContract.filters.PassPurchased(checksumAddress);
      const pEvents = await passContract.queryFilter(pFilter, fromBlock);
      if (pEvents && pEvents.length > 0) {
        const latest: any = pEvents[pEvents.length - 1];
        if (latest.args) {
          passTokenId = latest.args[1].toString();
          passTier = Number(latest.args[2]);
          passExpiresAt = Number(latest.args[3]);
        }
      }

      // Check Transfer events to this address
      if (!passTokenId) {
        const tFilter = passContract.filters.Transfer(null, checksumAddress);
        const tEvents = await passContract.queryFilter(tFilter, fromBlock);
        if (tEvents && tEvents.length > 0) {
          const latest: any = tEvents[tEvents.length - 1];
          if (latest.args) {
            passTokenId = latest.args[2].toString();
          }
        }
      }

      // If user owns an NFT balance > 0, ensure it is recognized as at least Tier 1 (Pro Pass)
      if (passTier === 0) {
        passTier = 1;
      }
    } catch {
      if (passBalance > 0 && passTier === 0) {
        passTier = 1;
      }
    }
  }

  // 4. Scan ZentrixReputation ERC-721 Soulbound credentials
  try {
    const rawRepBal = await repContract.balanceOf(checksumAddress);
    reputationCount = Number(rawRepBal);

    if (reputationCount > 0) {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 20000);
      const repFilter = repContract.filters.Transfer(null, checksumAddress);
      const repEvents = await repContract.queryFilter(repFilter, fromBlock);
      reputationTokenIds = repEvents
        .map((e: any) => e.args?.[2]?.toString())
        .filter(Boolean);
    }
  } catch {
    // repContract scan fallback
  }

  const result: NFTScanResult = {
    hasPass: passBalance > 0 || passTier > 0,
    passTier,
    passTokenId: passTokenId || (passBalance > 0 ? "1" : null),
    passExpiresAt,
    passBalance,
    reputationCount,
    reputationTokenIds,
    lastScannedAt: Date.now(),
  };

  // Cache in localStorage for instant pre-hydration on next reload
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`zx_nft_cache_${normalized}`, JSON.stringify(result));
      window.dispatchEvent(new CustomEvent("zx_nft_scanned", { detail: result }));
    } catch (_) {}
  }

  return result;
}
