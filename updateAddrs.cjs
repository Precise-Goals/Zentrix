const fs = require('fs');

const repAbi = JSON.parse(fs.readFileSync('contracts/artifacts/contracts/ZentrixReputation.sol/ZentrixReputation.json', 'utf8')).abi;
const escrowAbi = JSON.parse(fs.readFileSync('contracts/artifacts/contracts/ZentrixEscrow.sol/ZentrixEscrow.json', 'utf8')).abi;
const passAbi = JSON.parse(fs.readFileSync('contracts/artifacts/contracts/ZentrixPass.sol/ZentrixPass.json', 'utf8')).abi;

const content = `export const CONTRACT_ADDRESSES = {
  ZentrixReputation: '0x2a0f4cB2c514edde59762D685EE57D0678813935',
  ZentrixEscrow: '0x8b6475a6C378625775Ca46447Fc52e483de896be',
  ZentrixPass: '0x3EDad230dCFc6Dd3C357490b9feDa49639646BB7'
};

export const CONTRACT_ABIS = {
  ZentrixReputation: ${JSON.stringify(repAbi, null, 2)},
  ZentrixEscrow: ${JSON.stringify(escrowAbi, null, 2)},
  ZentrixPass: ${JSON.stringify(passAbi, null, 2)}
};
`;

fs.writeFileSync('src/contracts.ts', content);
