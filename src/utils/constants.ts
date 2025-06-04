// EIP-3009 Transfer Authorization Types
export const authorizationTypes = {
	TransferWithAuthorization: [
		{ name: "from", type: "address" },
		{ name: "to", type: "address" },
		{ name: "value", type: "uint256" },
		{ name: "validAfter", type: "uint256" },
		{ name: "validBefore", type: "uint256" },
		{ name: "nonce", type: "bytes32" },
	],
};

// Network configurations
export const networkConfig = {
	"base-sepolia": {
		chainId: 84532,
		usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		usdcName: "USDC",
	},
	base: {
		chainId: 8453,
		usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		usdcName: "USDC",
	},
};