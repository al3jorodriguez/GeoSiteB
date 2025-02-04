const axios = require("axios");
const xmls2js = require("xml2js");
const { parse } = require("papaparse");

const serverSites = "https://os.zhdk.cloud.switch.ch/edna";
const server = "https://os.zhdk.cloud.switch.ch/edna/?max-keys=1000000000";
const serverCountries =
  "https://os.zhdk.cloud.switch.ch/edna/bioms_country.txt";

const getXmlInfo = async () => {
  const response = await axios.get(server);
  return await xmls2js.parseStringPromise(response.data, {
    explicitArray: false,
    trim: true,
  });
};

const getCountriesInfo = async () => {
  try {
    const response = await getDataFromUrl(serverCountries);
    const countries = response.split("\n").filter(Boolean); // Eliminar líneas vacías

    let countriesNotFound = [];  // Almacena países sin respuesta (404)
    let countriesWithResponse = []; // Almacena países con respuesta válida

    const sitesPromises = countries.map(async (country) => {
      try {
        const data = await getDataFromUrl(`${serverSites}/${country}/monitoring/monitoring.txt`);
        countriesWithResponse.push(country); // Si no falla, agregar a la lista de países con respuesta
        return data.split("\n").filter(Boolean); // Separar en líneas y eliminar vacíos
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.warn(`Archivo no encontrado para el país: ${country}`);
          countriesNotFound.push(country); // Agregar a la lista de países sin datos
          return []; // Devolver array vacío
        }
        throw error; // Relanzar otros errores inesperados
      }
    });

    const sitesArrays = await Promise.all(sitesPromises);
    const sites = sitesArrays.flat(); // Unificar todos los sitios en un solo array

    return { sites, countriesNotFound, countriesWithResponse };
  } catch (error) {
    console.error("Error al obtener la información de los países:", error);
    return { countries: [], sites: [], countriesNotFound: [], countriesWithResponse: [] }; // Evitar fallos
  }
};



const getDataFromUrl = async (url) => {
  const response = await axios.get(url);
  return response.data;
};

const getDataByLanguage = (array) => {
  const result = {};
  let currentLanguage = "no-language-tags";

  // Diccionarios de traducción por idioma
  const translations = {
    en: {
      "Geographic Location": "Geographic location",
      "geographic location": "Geographic location",
      "geographic Location": "Geographic location",
      "Levels of protection": "Levels of protection",
      "Level of protection": "Levels of protection",
    },
    es: {
      Título: "Title",
      Autores: "Authors",
      Afiliación: "Affiliation",
      "Correo electrónico": "Email",
      Descripción: "Description",
      Tipología: "Typology",
      "Ubicación geográfica": "Geographic location",
      "Localización geográfica": "Geographic location",
      Clima: "Climate",
      "Ecosistema y hábitats": "Ecosystem and habitats",
      "Actividades humanas": "Human activities",
      "Niveles de protección": "Levels of protection",
      "Estrategia de muestreo": "Sampling strategy",
      "Datos y recursos": "Data and resources",
      "Información geoespacial": "Geospatial information",
      "Palabras clave": "Keywords",
      Citación: "Citation",
      "Conjuntos de datos relacionados": "Related datasets",
      "Información sobre financiación": "Funding information",
      "Detalles del autor": "Author details",
    },
    fr: {
      Titre: "Title",
      Auteurs: "Authors",
      Affiliation: "Affiliation",
      Courriel: "Email",
      Description: "Description",
      Typologie: "Typology",
      "Localisation géographique": "Geographic location",
      Climat: "Climate",
      "Écosystème et habitats": "Ecosystem and habitats",
      "Activités humaines": "Human activities",
      "Niveaux de protection": "Levels of protection:",
      "Stratégie d'échantillonnage": "Sampling strategy",
      "Données et ressources": "Data and resources",
      "Informations géospatiales": "Geospatial information",
      "Mots-clés": "Keywords",
      Citation: "Citation",
      "Ensembles de données associés": "Related datasets",
      "Informations de financement": "Funding information",
      "Détails de l'auteur": "Author details",
    },
  };

  array.forEach((item) => {
    const trimmedItem = item.trim();

    // Detecta etiquetas de idioma
    if (/^[A-Z]+$/.test(trimmedItem)) {
      currentLanguage = trimmedItem.toLowerCase();
      if (!result[currentLanguage]) {
        result[currentLanguage] = [];
      }
    } else {
      // Traduce y agrega al idioma actual
      if (!result[currentLanguage]) {
        result[currentLanguage] = [];
      }

      let newItem = trimmedItem;
      const langTranslations = translations[currentLanguage];

      if (langTranslations) {
        // Realiza las traducciones para el idioma actual
        Object.keys(langTranslations).forEach((key) => {
          newItem = newItem.replace(key, langTranslations[key]);
        });
      }

      result[currentLanguage].push(newItem);
    }
  });

  return result;
};

const getInfoFromTxt = async (url, lang, txtKeys = []) => {
  const descriptionKeys = [
    "Climate",
    "Geographic location",
    "Human activities",
    "Levels of protection",
    "Ecosystem and habitats",
    "Marine ecosystem type and habitat",
    "Sampling strategy",
    "Typology",
  ];

  const descriptionKeysText = descriptionKeys.map((d) => `${d}:`);

  const textContent = await getDataFromUrl(url);

  const text = textContent.split("\n").filter((line) => line.trim() !== "");

  const lines = getDataByLanguage(text);

  const data = { en: {}, fr: {}, es: {} };

  if (lines["no-language-tags"] == undefined) {
    Object.keys(lines).forEach((langLine) => {
      lines[langLine].forEach((line) => {
        const [key, ...value] = line.split(":").map((item) => item.trim());

        /**
         * not all elements have the same structure in the description.
         * So, It's necessary to define one.
         */

        if (value.length && keyInKeys(txtKeys, key)) {
          if (key === "Description") {
            const content = value.join(": ");
            data[langLine][key] = parseTxtInfo(
              content,
              descriptionKeysText,
              getChildrenFromKeys(txtKeys)
            );
          } else {
            if (descriptionKeysText.includes(`${key}:`)) {
              const result = parseTxtInfo(
                value.join(": "),
                descriptionKeysText
              );
              data[langLine]["Description"] = {
                ...data[langLine]["Description"],
                ...result,
              };
            } else {
              data[langLine][key] = value[0];
            }
          }
        }
      });
    });
    return data;
  }
};

const keyInKeys = (txtKeys, key) => {
  for (const i of txtKeys) {
    if (i.split(".")[0] === key) return true;
  }
  return false;
};

/**
 * get children from keys of type parent.child
 * example (Description.Climate)
 * @param {string[]} txtKeys
 * @returns
 */
const getChildrenFromKeys = (txtKeys) => {
  const keys = [];
  for (const i of txtKeys) {
    const [_, child] = i.split(".");
    if (child) keys.push(child);
  }
  return keys;
};

/**
 *
 * @param {string} content
 * @param {string[]} descriptionKeys
 * @param {string[]} only
 * @returns
 */
const parseTxtInfo = (content, descriptionKeys, only = []) => {
  const keysIndex = [];
  descriptionKeys.forEach((_key) => {
    const start = content.indexOf(_key);
    if (start > -1) {
      keysIndex.push({
        key: _key,
        start,
        end: start + _key.length,
      });
    }
  });

  const result = {};

  for (const i of keysIndex) {
    const target = i.end;
    const elements = keysIndex.filter((element) => element.start > target);

    const key = i.key.replace(":", "");
    if (elements.length) {
      const closest = elements.reduce((prev, curr) => {
        return Math.abs(curr.start - target) < Math.abs(prev.start - target)
          ? curr
          : prev;
      });

      if (only.length) {
        if (only.includes(key)) {
          result[key.toLowerCase()] = content
            .substring(i.end, closest.start - 1)
            .trim();
        }
      } else {
        result[key.toLowerCase()] = content
          .substring(i.end, closest.start - 1)
          .trim();
      }
    } else {
      if (only.length) {
        if (only.includes(key)) {
          result[key.toLowerCase()] = content
            .substring(i.end, content.length)
            .trim();
        }
      } else {
        result[key.toLowerCase()] = content
          .substring(i.end, content.length)
          .trim();
      }
    }
  }
  return result;
};

const parseCsvToJSON = async (resourceUrl) => {
  const csv = await axios.get(resourceUrl);
  const { data } = parse(csv.data, {
    header: true,
    skipEmptyLines: true,
  });
  return data;
};

const getDataListSeries = async (resourceUrl) => {
  return await parseCsvToJSON(resourceUrl);
};

const getMostRecentYear = (dataList, prefix) => {
  const currentYear = new Date().getFullYear();
  const index = dataList.findIndex((data) => +data.Year === currentYear);

  if (index > -1) {
    for (let i = index; i >= 0; i--) {
      if (dataIsOk(dataList[i], getTimeSeriesFields(prefix)))
        return dataList[i].Year;
    }
  }
  return 0;
};

function findYearWithValue(data, key) {
  for (const item of data) {
    if (item[key] && item[key] !== "NA") {
      return item.Year; // Devuelve el año correspondiente
    }
  }
  return null; // Devuelve null si no se encuentra ningún valor diferente de 'NA'
}

function findLastYearWithValues(data, keys) {
  let lastYear = null;

  for (const item of data) {
    for (const key of keys) {
      if (item[key] && item[key] !== "NA") {
        lastYear = item.Year; // Actualiza con el último año donde al menos una clave tiene valor válido
        break; // Sale del loop interno para evitar comparaciones innecesarias
      }
    }
  }
  return lastYear; // Retorna el último año encontrado o null si no hay valores válidos
}

function sumSimilarKeysByYear(data, keyGroups) {
  return data.map((item) => {
    let newItem = { ...item }; // Copia el objeto original

    for (const [newKey, keysToSum] of Object.entries(keyGroups)) {
      let values = keysToSum.map((key) => item[key]); // Obtiene los valores de las llaves

      // Si ambos valores son 'NA', el total será 'NA'
      if (values.every((val) => val === "NA")) {
        newItem[newKey] = "NA";
      } else {
        // Sumar solo los valores numéricos válidos
        let sum = 0;
        let validValuesCount = 0; // Contador para los valores numéricos

        values.forEach((val) => {
          // Convertir solo si no es 'NA'
          if (val !== "NA") {
            const numericValue = parseFloat(val); // Convertir a número
            if (!isNaN(numericValue)) {
              sum += numericValue; // Sumar los valores numéricos
              validValuesCount++;
            }
          }
        });

        // Si hay valores numéricos, asignamos la suma
        if (validValuesCount > 0) {
          newItem[newKey] = sum.toFixed(6); // Asignamos la suma con 6 decimales
        } else {
          newItem[newKey] = "NA"; // Si no hay valores numéricos válidos, el total es 'NA'
        }
      }
    }

    return newItem;
  });
}

const dataIsOk = (data, fields) => {
  if (!fields.length) return false;
  let allOk = true;
  for (let i in data) {
    if (fields.includes(i)) {
      if (data[i] === "NA") {
        allOk = false;
        break;
      }
    }
  }
  return allOk;
};

const getTimeSeriesFields = (prefix) => {
  const fields = {
    fw: [
      "Carnivores_index",
      "Chiropteres_index",
      "Eulipotyphla_index",
      "Primates_index",
      "Rodents_index",
      "Artiodactyla_index",
    ],
    ma: [
      "Planktonivores_index",
      "Herbivores_index",
      "Invertivores_scavengers_index",
      "Omnivores_index",
      "Large_piscivores_index",
      "Small_piscivores_index",
    ],
    fw_: [
      "Planktonivores_index",
      "Herbivores_index",
      "Invertivores_scavengers_index",
      "Omnivores_index",
      "Large_piscivores_index",
      "Small_piscivores_index",
    ],
  };
  return fields[prefix] || [];
};

module.exports = {
  getDataFromUrl,
  getXmlInfo,
  getInfoFromTxt,
  parseCsvToJSON,
  getDataListSeries,
  getMostRecentYear,
  findYearWithValue,
  findLastYearWithValues,
  sumSimilarKeysByYear,
  getCountriesInfo,
};
