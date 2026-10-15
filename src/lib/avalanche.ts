// Avalanche C-Chain (Fuji testnet) integration:
//   1. read the user's live AVAX balance for the portfolio view
//   2. after the user approves a proposal, write a "protection receipt": a 0-AVAX
//      self-transfer whose calldata is the approved rule, so the decision is on-chain
//      and verifiable on Snowtrace. No contract deployment needed.

import { createPublicClient, createWalletClient, formatEther, http, isAddress, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { config } from "./config";
import type { Proposal, ProtectionReceipt } from "./types";

const FUJI_CHAIN_ID = 43113;
const EXPLORER = "https://testnet.snowtrace.io/tx/";

function publicClient() {
  return createPublicClient({ chain: avalancheFuji, transport: http(config.avalanche.rpcUrl) });
}

export async function getAvaxBalance(address: string): Promise<number | null> {
  if (!isAddress(address)) return null;
  try {
    const wei = await publicClient().getBalance({ address });
    return Number(formatEther(wei));
  } catch {
    return null;
  }
}

export async function recordProtection(proposal: Proposal): Promise<ProtectionReceipt> {
  const memo = JSON.stringify({
    app: "U-Guard",
    v: 1,
    rule: proposal.action,
    symbol: proposal.symbol,
    risk: proposal.riskLevel,
    unlockDate: proposal.unlockDate,
    approvedAt: new Date().toISOString(),
  });
  return recordMemo(proposal.id, memo);
}

/** Write any approved decision (protection rule or trade plan) as a Fuji self-transfer memo. */
export async function recordMemo(id: string, memo: string): Promise<ProtectionReceipt> {
  const proposal = { id };

  if (!config.avalanche.demoPrivateKey) {
    return {
      proposalId: proposal.id,
      mode: "simulated",
      chain: "Avalanche Fuji (simulated)",
      txHash: null,
      explorerUrl: null,
      memo,
      note: "Set DEMO_PRIVATE_KEY (testnet) to record it on Fuji for real",
    };
  }

  const client = publicClient();
  if ((await client.getChainId()) !== FUJI_CHAIN_ID) {
    throw new Error("AVALANCHE_RPC_URL is not Fuji testnet; refusing to sign");
  }
  const account = privateKeyToAccount(config.avalanche.demoPrivateKey as Hex);
  const wallet = createWalletClient({ account, chain: avalancheFuji, transport: http(config.avalanche.rpcUrl) });
  const txHash = await wallet.sendTransaction({ to: account.address, value: 0n, data: toHex(memo) });

  let note: string | undefined;
  try {
    await client.waitForTransactionReceipt({ hash: txHash, timeout: 20_000 });
  } catch {
    note = "Transaction sent, waiting for network confirmation";
  }
  return {
    proposalId: proposal.id,
    mode: "onchain",
    chain: "Avalanche Fuji",
    txHash,
    explorerUrl: `${EXPLORER}${txHash}`,
    memo,
    note,
  };
}
