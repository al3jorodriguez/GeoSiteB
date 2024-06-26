const axios = require('axios');
const xmls2js = require('xml2js');
const { parse } = require('papaparse');

const server = 'https://os.zhdk.cloud.switch.ch/edna';

const getXmlInfo = async() => {
    const response = await axios.get(server);
    return await xmls2js.parseStringPromise(response.data, {
        explicitArray: false,
        trim: true,
    });
}

const getDataFromUrl = async (url) => {
    const response = await axios.get(url);
    return response.data;
}

const getInfoFromTxt = async(url, txtKeys = []) => {
    const descriptionKeys = [
        'Climate',
        'Geographic location',
        'Geographic Location',
        'Human activities',
        'Level of protection',
        'Levels of protection',
        'Ecosystem and habitats',
        'Marine ecosystem type and habitat',
        'Sampling strategy',
        'Typology',
    ];
    const descriptionKeysText = descriptionKeys.map(d=> `${d}:`);

    const textContent = await getDataFromUrl(url);

    const lines = textContent.split('\n').filter(line => line.trim() !== '');

    const data = {};

    lines.forEach(line => {
        const [key, ...value] = line.split(':').map(item => item.trim());

        /**
         * not all elements have the same structure in the description.
         * So, It's necessary to define one.
         */
        
        if (value.length && keyInKeys(txtKeys, key)) {
            if (key === 'Description') {
                const content = value.join(": ");
                data[key] = parseTxtInfo(content, descriptionKeysText, getChildrenFromKeys(txtKeys));
            } else {
                if (descriptionKeysText.includes(`${key}:`)) {
                    const result = parseTxtInfo(value.join(": "), descriptionKeysText);
                    data['Description'] = {
                        ...data['Description'],
                        ...result
                    };
                } else {
                    data[key] = value[0];
                }
            }
        }
    });
    return data;
}

const keyInKeys = (txtKeys, key) => {
    for (const i of txtKeys) {
        if (i.split('.')[0] === key) return true;
    }
    return false;
}

const getChildrenFromKeys = (txtKeys) => {
    const keys = []
    for (const i of txtKeys) {
        const [_, child] = i.split('.')
        if (child) keys.push(child);
    }
    return keys;
}

const parseTxtInfo = (content, descriptionKeys, only = []) => {
    const keysIndex = [];
    descriptionKeys.forEach(_key => {
        const start = content.indexOf(_key);
        if (start > -1) {
            keysIndex.push({
                key: _key,
                start,
                end: start + _key.length
            });
        }
    });

    const result = {};

    for (const i of keysIndex) {
        const target = i.end;
        const elements = keysIndex.filter(element => element.start > target);

        const key = i.key.replace(':', '');
        if (elements.length) {
            const closest = elements.reduce((prev, curr) => {
                return (Math.abs(curr.start - target) < Math.abs(prev.start - target) ? curr : prev);
            });
            
            if (only.length) {
                if (only.includes(key)) {
                    result[key.toLowerCase()] = content.substring(i.end, closest.start -1).trim();
                }
            } else {
                result[key.toLowerCase()] = content.substring(i.end, closest.start -1).trim();
            }
        } else {
            if (only.length) {
                if (only.includes(key)) {
                    result[key.toLowerCase()] = content.substring(i.end, content.length).trim();
                }
            }
            else {
                result[key.toLowerCase()] = content.substring(i.end, content.length).trim();
            }
        }
    }
    return result;
}

const parseCsvToJSON = async(resourceUrl) => { 
    const csv = await axios.get(resourceUrl);
    const { data } = parse(csv.data, {
        header: true,
        skipEmptyLines: true,
    });
    return data;
}

const getDataListSeries = async(resourceUrl) => {
    return await parseCsvToJSON(resourceUrl);
}

const getMostRecentYear = (dataList, prefix) => {
    const currentYear = new Date().getFullYear();
    const index = dataList.findIndex(data => +data.Year === currentYear);

    if (index > -1) {
        for (let i = index; index >= 0; i--) {
            if (dataIsOk(dataList[i], getTimeSeriesFields(prefix))) return dataList[i].Year;
        }
    }
    return 0;
}

const dataIsOk = (data, fields) => {
    if (!fields.length) return false;
    let allOk = true;
    for (let i in data) {
        if (fields.includes(i)) {
            if (data[i] === 'NA') {
                allOk = false;
                break;
            }

        }
    }
    return allOk;
}

const getTimeSeriesFields = (prefix) => {
    const fields = {
        fw: [
            'Carnivora_index', 
            'Chiroptera_index', 
            'Eulipotyphla_index', 
            'Primate_index',
            'Rodentia_index',
            'Artiodactyla_index'
        ],
        ma: [],
    };
    return fields[prefix] || []
}

module.exports = {
    getDataFromUrl,
    getXmlInfo,
    getInfoFromTxt,
    parseCsvToJSON,
    getDataListSeries,
    getMostRecentYear
}