const {
  getXmlInfo,
  getDataFromUrl,
  getInfoFromTxt,
  parseCsvToJSON,
  getDataListSeries,
  findLastYearWithValues,
  sumSimilarKeysByYear,
} = require("./utils");

const server = "https://os.zhdk.cloud.switch.ch/edna";

const imgExtensions = ["jpg", "png", "jpeg"];
const fileExtensions = ["txt", "json", "csv", "pdf"];
const allExtensions = [...imgExtensions, ...fileExtensions];

const getById = async (id, lang) => {
  const xml = await getXmlInfo();

  const allowedtxtKeys = [
    "Title",
    "Affiliation",
    "Author Details",
    "Authors",
    "Citation",
    "Data and ressources",
    "Email",
    "Funding information",
    "Geospatial Information",
    "Keywords",
    "Related Datasets",
    "Description",
    /**
     * search for keys outside the description
     */
    "Geographic Location",
    "Geographic location",
    "Marine ecosystem type and habitat",
    "Human activities",
    "Level of protection",
    "Levels of protection",
  ];
  const queries = [];
  const keys = [];
  const result = {};
  xml.ListBucketResult.Contents.forEach((current) => {
    if (+current.Size > 0) {
      //const number = current.Key.match(/\d+/);
      const numbers = current.Key.match(/\d+/g);
      const lastNumber = numbers ? numbers[numbers.length - 1] : null;
      const number = [lastNumber];
      if (number?.[0] === id) {
        const key = current.Key.split("/");
        const [prefix] = key?.[0]?.split("_");
        const extension = key[key.length - 1].substring(
          key[key.length - 1].lastIndexOf(".") + 1
        );
        // evaluates if extension is valid
        if (allExtensions.includes(extension.toLowerCase())) {
          // set group if it has one
          if (!result.hasOwnProperty("prefix") && prefix)
            result["prefix"] = prefix;

          //get information from id
          if (extension === "json") {
            let type = key[key.length - 1];
            const file = key[key.length - 1];
            if (!file.includes("points") || !type.includes("point")) {
              queries.push(getDataFromUrl(`${server}/${current.Key}`));
              keys.push("geometry");
            }
          }

          if (extension === "txt") {
            queries.push(
              getInfoFromTxt(`${server}/${current.Key}`, lang, allowedtxtKeys)
            );
            keys.push("info");
          }

          if (imgExtensions.includes(extension.toLowerCase())) {
            result["img"] = `${server}/${current.Key}`;
          }

          if (extension === "csv") {
            const file = key[key.length - 1];
            /** mammal species info */
            if (file.includes("taxa")) {
              queries.push(parseCsvToJSON(`${server}/${current.Key}`));
              keys.push("taxa");
            }
            /** time series line chart */
            if (file.includes("time_series")) {
              queries.push(getDataListSeries(`${server}/${current.Key}`));
              keys.push("time");
            }
          }
          if (extension === "pdf") {
            queries.push(`${server}/${current.Key}`);
            keys.push("report");
          }
        }
      }
    }
  });

  const data = await Promise.all(queries);

  // info to show species info
  const prefixes = {
    ma: [
      "Large_piscivores",
      "Large_omnivores",
      "Small_omnivores",
      "Herbivores",
      "Planktonivores",
      "Small_piscivores",
    ],
    fw: [
      "Rodents_Lagomorpha",
      "Diprotodontia_Eulipotyphla",
      "Artiodactyla",
      "Carnivores",
      "Chiropteres",
      "Primates",
    ],
    fw_: [
      "Large_piscivores",
      "Large_omnivores",
      "Small_omnivores",
      "Herbivores",
      "Planktonivores",
      "Small_piscivores",
    ],
  };

  // time series line chart legend
  const legend = {
    fw: ["Climate", "Human", "Vegetation", "Integrity index"],
    fw_: ["Climate", "Human", "Vegetation", "Integrity index"],
    ma: ["Climate", "Human", "Vegetation", "Integrity index"],
  };

  const langLargeRiver = {
    en: "Large river.",
    es: "Gran río.",
    fr: "Grande rivière.",
  };

  const dataKeys = legend[result.prefix].map((d) =>
    !d.includes("Integrity") ? d + "_intercept" : d
  );

  if (result.prefix) {
    if (data[0][lang].Description.typology == langLargeRiver[lang]) {
      result.prefix = "fw_";
    }
    result["species"] = [];
    for (const p of prefixes?.[result.prefix] || []) {
      result["species"].push({
        name: p,
        icon: `/assets/icons/cards/species/${
          result.prefix
        }/${p.toLowerCase()}.svg`,
        quantity: "--", // search value
      });
    }
    // Definir grupos de llaves a sumar
    const keyGroups = {
      Climate_total: ["Climate_intercept", "Climate_change"],
      Vegetation_total: ["Vegetation_intercept", "Vegetation_change"],
      Human_total: ["Human_intercept", "Human_change"],
    };

    for (const [index, d] of data.entries()) {
      if (keys[index] !== "time") {
        result[keys[index]] = d;
      } else {
        const total = sumSimilarKeysByYear(d, keyGroups);
        const speciesHeader = result.prefix === "ma" ? "" : "_richness";
        const mostRecentYearLine = findLastYearWithValues(d, dataKeys);
        let mostRecentYear = findLastYearWithValues(d, [
          `${prefixes[result.prefix][0]}${speciesHeader}`,
        ]);
        mostRecentYear =
          mostRecentYear === null ? mostRecentYearLine : mostRecentYear;
        result[keys[index]] = {
          series: total,
          mostRecentYear,
          mostRecentYearLine,
          legend: legend[result.prefix].map((l) => ({
            name: l,
            icon: `/assets/icons/charts/legend/time-series-changes/${l
              .toLocaleLowerCase()
              .trim()
              .replace(" ", "-")}.svg`,
          })),
        };

        const dataYear = d.find((_d) => _d.Year == mostRecentYear);

        result.species = result.species.map((specie) => ({
          ...specie,
          quantity: dataYear?.[`${specie.name}${speciesHeader}`] || "--",
        }));
      }
    }
  }

  return result;
};

module.exports = {
  getById,
};
