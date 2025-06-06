import { useConnect, useSwitchChain } from "wagmi";
import { base } from "viem/chains";

function WalletOptions() {
  const { connectors, connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();

  return connectors.map((connector) => (
    <div className="py-2" key={connector.uid}>
      <button
        type="button"
        className="px-4 py-2 bg-gradient-to-b from-gray-200 to-gray-300 border-2 border-gray-400 rounded text-sm font-bold text-gray-800 hover:from-gray-300 hover:to-gray-400 disabled:from-gray-100 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed active:border-gray-500 active:from-gray-300 active:to-gray-400"
        onClick={async () => {
          await connectAsync({ connector });
          await switchChainAsync({ chainId: base.id });
        }}
      >
        {connector.name}
      </button>
    </div>
  ));
}

export default WalletOptions;
