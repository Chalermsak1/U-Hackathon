// Sign-In with Ethereum (EIP-4361) using viem's own SIWE helpers. Fits a self-custody
// wallet: the user proves they own an address by signing a message; no password, no keys
// leave the wallet. Works with any EVM wallet (Core, MetaMask...).
// Note: this verifies EOA signatures. Smart-contract wallets (ERC-1271/6492, e.g. an
// ERC-4337 account) need publicClient.verifySiweMessage against their chain.

import { verifyMessage, type Hex } from "viem";
import { generateSiweNonce, parseSiweMessage, validateSiweMessage } from "viem/siwe";

export const newNonce = generateSiweNonce;

export async function verifySiwe(input: {
  message: string;
  signature: string;
  nonce: string | null;
  host: string;
}): Promise<{ address: `0x${string}` } | { error: string }> {
  if (!input.nonce) return { error: "Sign-in expired. Please try again." };
  if (!/^0x[0-9a-fA-F]+$/.test(input.signature)) return { error: "Invalid signature." };
  const fields = parseSiweMessage(input.message);
  if (!fields.address) return { error: "Invalid sign-in message." };
  const valid = validateSiweMessage({ message: fields, domain: input.host, nonce: input.nonce, time: new Date() });
  if (!valid) return { error: "Sign-in message does not match this site or has expired." };
  if (fields.issuedAt && Date.now() - fields.issuedAt.getTime() > 10 * 60_000) return { error: "Sign-in message is too old." };
  const ok = await verifyMessage({ address: fields.address, message: input.message, signature: input.signature as Hex });
  return ok ? { address: fields.address } : { error: "Signature does not match the address." };
}
