const {
  getXmlInfo,
  getDataFromUrl,
  getInfoFromTxt,
  getCountriesInfo,
  getDataListSeries,
  findLastYearWithValues,
} = require("./utils");
const turf = require("@turf/turf");

const server = "https://os.zhdk.cloud.switch.ch/edna";

const imgExtensions = ["jpg", "png", "jpeg"];

const getCountryAndSites = async () => {
  const data = await getCountriesInfo();
  return data;
};

const getList = async (lang) => {
  const txtKeys = [
    "Title",
    "Description.Typology",
    "Description.Geographic location",
  ];
  const xml = await getXmlInfo();

  const errors = [];
  let array_ = [];
  let result = [];
  const keys = [];

  const obj = await xml.ListBucketResult.Contents.reduce(
    async (accPromise, current) => {
      const acc = await accPromise;
      /** Folder is not empty */
      array_.push(current);
      /* if (current.Key.includes("1110009240")) {
        console.log("aqui");
      } */
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
              lang,
              txtKeys
            );
            /**get description from element */
            if (!acc[number[0]].hasOwnProperty("prefix")) {
              const [prefix] = key?.[0]?.split("_") || "default";
              /**get prefix using typology from element */
              const prefixes = {
                en: {
                  "Mountain catchment.": "fw",
                  "Large river.": "fw_",
                  "Marine coastal area.": "ma",
                  "Marine Coastal area.": "ma",
                  "marine coastal area.": "ma",
                  "Coastal marine area.": "ma",
                },
                fr: {
                  "Bassin de montagne.": "fw",
                  "Bassin versant de montagne.": "fw",
                  "Grande rivière.": "fw_",
                  "Zone côtière marine.": "ma",
                  "Zone marine côtière.": "ma",
                  "zone côtière marine.": "ma",
                },
                es: {
                  "Cuenca de montaña.": "fw",
                  "Cuenca montañosa.": "fw",
                  "zona costera marina.": "ma",
                  "Zona costera marina.": "ma",
                  "Área marina costera.": "ma",
                  "Área costera marina.": "ma",
                  "Gran río.": "fw_",
                },
              };
              if (
                acc[number[0]]["info"] != undefined &&
                acc[number[0]]["info"][lang][txtKeys[1].split(".")[0]] !=
                  undefined
              ) {
                //console.log(acc[number[0]]);
                acc[number[0]]["prefix"] =
                  prefixes[lang][
                    acc[number[0]]["info"][lang][txtKeys[1].split(".")[0]][
                      txtKeys[1].split(".")[1].toLowerCase()
                    ]
                  ];
                //console.log(key[2] + "," + acc[number[0]]["info"][txtKeys[1].split(".")[0]][txtKeys[1].split(".")[1].toLowerCase()]);
                //console.log(acc[number[0]]);
                //console.log(acc[number[0]]["prefix"]);
              }
            }
          }
          /** time series*/
          if (extension === "csv") {
            let type = key[key.length - 1];
            if (type.includes("time_series")) {
              const data = await getDataListSeries(`${server}/${current.Key}`);
              let mostRecentYear = findLastYearWithValues(data, [
                "Integrity_index",
              ]);
              const dataYear = data.find((_d) => _d.Year == mostRecentYear);
              if (dataYear != undefined) {
                acc[number[0]]["integrity_index"] = dataYear.Integrity_index;
                let integrityIndex = acc[number[0]]["integrity_index"];
                if (integrityIndex >= 0 && integrityIndex <= 0.2) {
                  acc[number[0]]["icon"] = "/assets/icons/map/point_red.svg";
                } else if (integrityIndex > 0.2 && integrityIndex <= 0.4) {
                  acc[number[0]]["icon"] = "/assets/icons/map/point_orange.svg";
                } else if (integrityIndex > 0.4 && integrityIndex <= 0.6) {
                  acc[number[0]]["icon"] = "/assets/icons/map/point_yellow.svg";
                } else if (integrityIndex > 0.6) {
                  acc[number[0]]["icon"] = "/assets/icons/map/point_green.svg";
                } else {
                  acc[number[0]]["icon"] = "/assets/icons/map/point_gray.svg"; // Fallback en caso de error
                }
              } else {
                acc[number[0]]["integrity_index"] = null;
                acc[number[0]]["icon"] = "/assets/icons/map/point_gray.svg"; // Fallback en caso de error
              }
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
    if (obj[key]["geometry"] && obj[key]["img"] && obj[key]["info"]) {
      //console.log(`${key}_${obj[key]["prefix"]}`);
      //console.log(`${key}_${obj[key]["prefix"]}, ${lang}`);
      //console.log(obj[key]["icon"]);
      const element = {
        id: key,
        img: obj[key]["img"],
        info: obj[key]["info"],
        geometry: obj[key]["geometry"],
        prefix: obj[key]["prefix"],
        species: obj[key]["species"],
        icon: obj[key]["icon"],
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
  getCountryAndSites,
};
