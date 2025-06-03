import { DuneClient } from "@duneanalytics/client-sdk";
const dune = new DuneClient("ws43hEimsYCe8uPdQ7zjS3ITvgoElMe5");

const queryId = 5183571;
const getShortLongOI = async () => {
  const query_result = await dune.getLatestResult({ queryId });
  console.log(query_result.result?.rows);
  return query_result.result?.rows;
};
getShortLongOI().then((res) => {
  console.log(res);
});

export default getShortLongOI;
