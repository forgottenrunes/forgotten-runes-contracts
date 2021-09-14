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
