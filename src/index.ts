import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@project-serum/anchor";
import idl from "./idl.json";
import { appendToSheet } from "./sheet";

// Use Triton One RPC

const RPC_ENDPOINT = "https://nameless-fragrant-sailboat.solana-mainnet.quiknode.pro/a2e32da5e7a31ab275595af34bfe3f730de293a6/";
const PROGRAM_ID = new PublicKey("PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu");
const JLP_TOKEN = new PublicKey("27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4");
const USD_DECIMALS = 6;
const POOL_PUBKEY = new PublicKey(
  "5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq"
);
const CUSTODY_PUBKEYS = [
  {
    symbol: "SOL",
    pubkey: new PublicKey("7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz"),
  },
  {
    symbol: "BTC",
    pubkey: new PublicKey("5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxuFtv5bMMALkm"),
  },
  {
    symbol: "ETH",
    pubkey: new PublicKey("AQCGyheWPLeo6Qp9WpYS9m3Qj479t7R636N9ey1rEjEn"),
  },
  {
    symbol: "USDC",
    pubkey: new PublicKey("G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa"),
  },
  {
    symbol: "USDT",
    pubkey: new PublicKey("4vkNeXiYEUizLdrpdPS1eC2mccyM4NUPRtERrk6ZETkk"),
  },
];

async function main() {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  (async () => {
    const version = await connection.getVersion();
    console.log("Solana Node Version:", version);
  })();
  const provider = new AnchorProvider(connection, {} as any, {});
  const program = new Program(idl as Idl, PROGRAM_ID, provider);

  const supplyResp = await connection.getTokenSupply(JLP_TOKEN);
  const supply = supplyResp.value.uiAmount;
  if (supply == null) throw new Error("Token supply is null!");

  const pool = await program.account.pool.fetch(POOL_PUBKEY);
  const poolAum = Number(pool.aumUsd) / 10 ** USD_DECIMALS;
  const poolLimitUsd = Number(pool.limit.maxAumUsd) / 10 ** USD_DECIMALS;
  const poolAprBps = Number(pool.poolApr.feeAprBps);
  const poolRealizedFee =
    Number(pool.poolApr.realizedFeeUsd) / 10 ** USD_DECIMALS;
  const theoPrice = poolAum / supply;

  const rows: any[][] = [];

  // Indexes of header rows (to style them)
  const headerRowIndexes: number[] = [];

  // 🟦 Pool Info Section
  headerRowIndexes.push(rows.length); // will be 0
  rows.push([
    "Type",
    "Timestamp",
    "Pool AUM",
    "Token Supply",
    "Max AUM",
    "Pool APR (bps)",
    "Realized Fee",
    "Theoretical Price",
  ]);
  rows.push([
    "Pool Info",
    new Date().toISOString(),
    poolAum,
    supply,
    poolLimitUsd,
    poolAprBps,
    poolRealizedFee,
    theoPrice,
  ]);

  // 🟪 Custody Info Section
  headerRowIndexes.push(rows.length); // will be 2
  rows.push([
    "Symbol",
    "Target Ratio (bps)",
    "Max Long Size",
    "Max Short Size",
    "Fees Reserve",
    "Locked",
    "Guaranteed USD",
    "Short Avg Price",
    "Max Leverage",
    "Exposure",
  ]);

  const custodyData: Record<string, { custody: any; decimals: number }> = {};

  for (const { symbol, pubkey } of CUSTODY_PUBKEYS) {
    const custody = await program.account.custody.fetch(pubkey);
    const decimals = custody.decimals;
    custodyData[symbol] = { custody, decimals };
  }

  for (const symbol of Object.keys(custodyData)) {
    const { custody, decimals } = custodyData[symbol];
    const owned = Number(custody.assets.owned) / 10 ** decimals;
    const globalShortSizes = Number(custody.assets.globalShortSizes) / 10 ** 6;
    const feeReserves = Number(custody.assets.feesReserves) / 10 ** decimals;
    const exposure = (owned + globalShortSizes + feeReserves) / supply;

    rows.push([
      symbol,
      Number(custody.targetRatioBps),
      Number(custody.pricing.maxGlobalLongSizes) / 10 ** 6,
      Number(custody.pricing.maxGlobalShortSizes) / 10 ** 6,
      feeReserves,
      Number(custody.assets.locked) / 10 ** decimals,
      Number(custody.assets.guaranteedUsd) / 10 ** 6,
      Number(custody.assets.globalShortAveragePrices) / 10 ** 6,
      Number(custody.pricing.maxLeverage) / 10 ** 6,
      exposure,
    ]);
  }

  await appendToSheet(rows, headerRowIndexes);
  console.log("All data written with formatting.");
}
main().catch(console.error);
