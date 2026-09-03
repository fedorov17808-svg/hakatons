import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n=============================================================`);
  console.log(`CreditPulseASCV2 UUPS Proxy Deployment`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`=============================================================\n`);

  const blockProver = process.env.BLOCK_PROVER_ADDRESS || "0x0000000000000000000000000000000000000FD2";
  const oracleSigner = deployer.address;

  // 1. Deploy Implementation
  console.log("1. Deploying CreditPulseASCV2 Implementation...");
  const V2Factory = await ethers.getContractFactory("CreditPulseASCV2", deployer);
  const implementation = await V2Factory.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log(`   Implementation Address: ${implAddress}`);

  // 2. Prepare Initialization Calldata
  console.log("2. Encoding Initialization Data (v8.0.0)...");
  const initCalldata = implementation.interface.encodeFunctionData("initialize", [
    blockProver,
    oracleSigner,
  ]);

  // 3. Deploy ERC1967 Proxy
  console.log("3. Deploying ERC1967Proxy pointing to implementation...");
  const ProxyFactory = await ethers.getContractFactory("ERC1967Proxy", deployer);
  const proxy = await ProxyFactory.deploy(implAddress, initCalldata);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`   Proxy Address: ${proxyAddress}`);

  // 4. Attach V2 interface to proxy
  const proxyContract = V2Factory.attach(proxyAddress);
  const version = await proxyContract.VERSION();
  const owner = await proxyContract.owner();
  console.log(`\n✅ UUPS Proxy Initialized: Version ${version}, Owner ${owner}`);

  // 5. Authorize DON Validator Nodes
  const donNodes = [
    "0x55ac26863a79cdab5304164afb3c5fac65916585",
    "0xfcad0b19bb29d4674531d6f115237e16afce377c",
    "0xb4b6059dbe03c873eb2d4b971a82ffd04368565a"
  ];

  console.log("\n4. Authorizing DON Validator Quorum Nodes...");
  for (const nodeAddr of donNodes) {
    const isAuth = await proxyContract.isAuthorizedOracle(nodeAddr);
    if (!isAuth) {
      console.log(`   Authorizing DON Node: ${nodeAddr}...`);
      const tx = await proxyContract.setOracleAuthorization(nodeAddr, true);
      await tx.wait();
    } else {
      console.log(`   DON Node ${nodeAddr} already authorized ✓`);
    }
  }

  console.log(`\n🎉 CreditPulseASCV2 UUPS Proxy Ready!`);
  console.log(`-------------------------------------------------------------`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${proxyAddress}`);
  console.log(`CONTRACT_ADDRESS=${proxyAddress}`);
  console.log(`IMPLEMENTATION_ADDRESS=${implAddress}`);
  console.log(`-------------------------------------------------------------\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
