import { Signer, Wallet } from 'ethers';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { JsonRpcProvider } from '@ethersproject/providers';

export async function getProvider() {
  switch (process.env.DEPLOY_ENV) {
    case 'rinkeby':
      return new JsonRpcProvider(process.env.RINKEBY_HTTP_ENDPOINT);
      break;
    case 'mainnet':
      return new JsonRpcProvider(process.env.ALCHEMY_HTTP_ENDPOINT);
      break;
    case 'localhost':
    default:
      return new JsonRpcProvider(process.env.NETWORK_URL);
      break;
  }
}

export async function getSigner({ provider }): Promise<Signer> {
  let signer: Signer;
  const deployEnv = process.env.DEPLOY_ENV;
  switch (deployEnv) {
    case 'localhost': {
      let wallet = Wallet.fromMnemonic(
        process.env.LOCALHOST_MNEMONIC,
        process.env.WALLET_HD_PATH || `m/44'/60'/0'/0/0`
      );
      wallet = wallet.connect(provider);
      signer = wallet;
      break;
    }
    case 'mainnet':
    case 'ropsten':
    case 'rinkeby':
    case 'matic': {
      const ledger = await new LedgerSigner(
        provider as any,
        'hid',
        process.env.LEDGER_HD_PATH || "m/44'/60'/0'/0/0"
      );
      signer = ledger as any;
      break;
    }
  }

  return signer;
}
