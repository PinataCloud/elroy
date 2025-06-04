import type { TypedData, TypedDataDomain } from "viem";

export interface TransferWithAuthorization {
	from: `0x${string}`;
	to: `0x${string}`;
	value: string;
	validAfter: string;
	validBefore: string;
	nonce: `0x${string}`;
}

// Standard EIP-712 typed data structure
export interface EIP712TypedData {
	types: TypedData;
	primaryType: string;
	domain?: TypedDataDomain;
	message: Record<string, any>;
}

// Flexible sign function that accepts the standard EIP-712 structure
// Users can adapt this to work with any library
export type SignTypedDataFunction = (
	typedData: EIP712TypedData,
) => Promise<`0x${string}`>;

export interface PaymentRequirements {
	scheme: "exact";
	network: "base-sepolia" | "base";
	maxAmountRequired: string;
	resource: string;
	description: string;
	mimeType: string;
	payTo: `0x${string}`;
	maxTimeoutSeconds: number;
	asset: `0x${string}`;
	extra?: {
		name: string;
		version: string;
	};
}

export interface X402Response {
	error: string;
	accepts: PaymentRequirements[];
	x402Version: number;
}

export interface PaymentPayload {
	x402Version: number;
	scheme: "exact";
	network: string;
	payload: {
		signature: `0x${string}`;
		authorization: TransferWithAuthorization;
	};
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}