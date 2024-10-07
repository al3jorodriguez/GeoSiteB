const { getXmlInfo, getDataFromUrl, getInfoFromTxt } = require("./utils");
const turf = require("@turf/turf");

const server = "https://os.zhdk.cloud.switch.ch/edna";

const imgExtensions = ["jpg", "png", "jpeg"];

const getList = async (txtKeys) => {
  const xml = await getXmlInfo();

  const errors = [];
  let array_ = [];

  const obj = await xml.ListBucketResult.Contents.reduce(
    async (accPromise, current) => {
      const acc = await accPromise;
      /** Folder is not empty */
      array_.push(current);
      if (+current.Size > 0) {
        const key = current.Key.split("/");
        const extension = key[key.length - 1].substring(
          key[key.length - 1].lastIndexOf(".") + 1
        );

        const number = current.Key.match(/\d+/);
        // condition to check if id is valid (ids with length > 6)
        if (number && number.length && number?.[0].length >= 6) {
          if (!acc.hasOwnProperty(number[0])) acc[number[0]] = {};

          /**only elements with image are shown */
          if (imgExtensions.includes(extension.toLowerCase())) {
            acc[number[0]]["img"] = `${server}/${current.Key}`;
          }
          /**get description from element */
          if (extension.toLowerCase() === "txt") {
            acc[number[0]]["info"] = await getInfoFromTxt(
              `${server}/${current.Key}`,
              txtKeys
            );
            /**get description from element */
            if (!acc[number[0]].hasOwnProperty("prefix")) {
              const [prefix] = key?.[0]?.split("_") || "default";
              /**get prefix using typology from element */
              const prefixes = { "Mountain catchment.": "fw", "Large river.": "fw_", "Marine coastal area.": "ma" };
              acc[number[0]]["prefix"] = prefixes[acc[number[0]]["info"].Description.typology];
            }
          }
          /**get centroid from polygon */
          if (extension === "json") {
            try {
              let type = key[key.length - 1];

              if (!type.includes("points") || !type.includes("point")) {
                const polygon = await getDataFromUrl(
                  `${server}/${current.Key}`
                );
                const centroid = turf.centroid(polygon);
                acc[number[0]]["geometry"] = centroid.geometry;
              }
            } catch (error) {
              errors.push({
                error: " Error processing polygon",
                id: number?.[0],
              });
            }
          }
        }
      }
      return acc;
    },
    {}
  );
  /** Convert object into array */
  //console.log(array_);
  const ma = [];
  const fw = [];
  const fw_ = [];
  for (const key in obj) {
    if (obj[key]["geometry"] && obj[key]["img"]) {
      const element = {
        id: key,
        img: obj[key]["img"],
        info: obj[key]["info"],
        geometry: obj[key]["geometry"],
        prefix: obj[key]["prefix"],
        species: obj[key]["species"],
      };
      if (obj[key]["prefix"] === "ma") {
        ma.push(element);
      }
      if (obj[key]["prefix"] === "fw") {
        fw.push(element);
      }
      if (obj[key]["prefix"] === "fw_") {
        fw_.push(element);
      }
    }
  }
  console.error(errors);
  return [...ma, ...fw, ...fw_];
};

module.exports = {
  getList,
};
