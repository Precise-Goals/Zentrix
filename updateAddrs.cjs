const fs = require('fs');
let contractsFile = fs.readFileSync('src/contracts.ts', 'utf8');

contractsFile = contractsFile.replace(/reputation: ".*"/, 'reputation: "0xbF3cB5e2163b0e6df4825EDb5a16d81f7c6D8502"');
contractsFile = contractsFile.replace(/escrow: ".*"/, 'escrow: "0x5d349C7C35408a87dc113e8438113e057e306165"');
contractsFile = contractsFile.replace(/pass: ".*"/, 'pass: "0x3106772B6F7481ec7B71776B78268D16aD9952D3"');

fs.writeFileSync('src/contracts.ts', contractsFile);
