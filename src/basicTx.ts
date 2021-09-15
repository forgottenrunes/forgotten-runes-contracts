import { Provider } from '@ethersproject/providers';
import { getProvider, getSigner } from './provider';
import { parseUnits } from '@ethersproject/units';

export type BuildTxFn = ({
  signer,
  provider,
  overrides,
}: {
  signer: any;
  provider: Provider;
  overrides: any;
}) => any;

export async function runBasicTx({
  gas,
  buildTx,
}: {
  gas: string;
  buildTx: BuildTxFn;
}) {
  const provider = await getProvider();
  console.log('provider: ', provider);

  let signer = await getSigner({ provider });
  const signerAddress = await signer.getAddress();
  console.log('Signer:', signerAddress);

  const balance = await provider.getBalance(signerAddress);
  console.log('Balance:', balance.toString());

  const overrides = {
    gasPrice: parseUnits(gas, 'gwei'),
  };

  const { tx } = await buildTx({ signer, provider, overrides });

  let txResponse = await signer.sendTransaction(tx);
  console.log('Submitted tx:', txResponse.hash);

  const receipt = await provider.waitForTransaction(
    txResponse.hash,
    1, // confirmations
    60 * 1000 * 30
  );

  console.log('receipt: ', receipt);
  const gasUsed = receipt.gasUsed;
  console.log('gasUsed:', gasUsed.toString());

  const contractAddress = receipt.contractAddress;
  console.log('contractAddress: ', contractAddress);
}
