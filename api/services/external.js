const axios = require('axios');
const xmls2js = require('xml2js');
const turf = require('@turf/turf');

const server = 'https://os.zhdk.cloud.switch.ch/edna';

/**
 * PRIVATE FUNCTIONS
 */

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

const getInfo = async(url, txtKeys) => {
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
        
        if (value.length && txtKeys.includes(key)) {
            if (key === 'Description') {
                const content = value.join(": ");
                data[key] = extractInfo(content, descriptionKeysText);
            } else {
                if (descriptionKeysText.includes(`${key}:`)) {
                    const result = extractInfo(value.join(": "), descriptionKeysText);
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

const extractInfo = (content, descriptionKeys) => {
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

        if (elements.length) {
            const closest = elements.reduce((prev, curr) => {
                return (Math.abs(curr.start - target) < Math.abs(prev.start - target) ? curr : prev);
            });
            result[i.key.replace(':', '')] = content.substring(i.end, closest.start -1).trim();
        } else {
            result[i.key.replace(':', '')] = content.substring(i.end, content.length).trim();
        }
    }
    return result;
}

/**
 * SERVICE FUNCTIONS
 */

const getList = async(txtKeys) => {
    const xml = await getXmlInfo();
    const imgExtensions = ['jpg', 'png', 'jpeg'];

    const errors = [];

    const obj = await xml.ListBucketResult.Contents.reduce(async(accPromise, current) => {
        const acc = await accPromise;
        if (+current.Size > 0) {

            const key = current.Key.split('/');
            const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);

            const number = current.Key.match(/\d+/);
            if (number && number.length && number?.[0].length >= 6) { // id is valid
                if (!acc.hasOwnProperty(number[0])) acc[number[0]] = {};
                /**only elements with image are shown */
                if (imgExtensions.includes(extension.toLowerCase())) {
                    acc[number[0]]['img'] = `${server}/${current.Key}`;
                }
                /**get description from element */
                if (extension.toLowerCase() === 'txt' ) { 
                    acc[number[0]]['info'] = await getInfo(`${server}/${current.Key}`, txtKeys);
                }
                 /**get centroid from polygon */
                if (extension === 'json') {
                    try {
                        let type = key[key.length -1];
                        
                        if (!type.includes('points')) {
                            const polygon = await getDataFromUrl(`${server}/${current.Key}`);
                            const centroid = turf.centroid(polygon);
                            acc[number[0]]['geometry'] = centroid.geometry;
                        }

                    } catch (error) {
                        errors.push({
                            error: ' Error processing polygon',
                            id: number?.[0]
                        });
                    }
                }
            }
        }
        return acc;
    }, {});
    /** Convert object into array */
    const data = [];
    for (const key in obj) {
        if (obj[key]['geometry']) {
            data.push({
                id: key,
                img: obj[key]['img'],
                info: obj[key]['info'],
                geometry: obj[key]['geometry'],
            });
        }
    }
    console.error(errors);
    return data;
}

const getDetailsById = async(id) => {
    const xml = await getXmlInfo();
    const allowedExtensions = ['txt', 'json', 'csv'];
    const allowedtxtKeys = [
        'Title',
        'Affiliation',
        'Author Details',
        'Authors',
        'Citation',
        'Data and ressources', 'Email',
        'Funding information',
        'Geospatial Information',
        'Keywords',
        'Related Datasets',
        'Description',
        /**
         * search for keys outside the description
         */
        'Geographic Location',
        'Geographic location',
        'Marine ecosystem type and habitat',
        'Human activities',
        'Level of protection',
        'Levels of protection'
    ];
    return await xml.ListBucketResult.Contents.reduce(async(accPromise, current) => {
        const acc = await accPromise;
        if (+current.Size > 0) {
            const number = current.Key.match(/\d+/);
            if(number?.[0] === id) {
                const key = current.Key.split('/');
                const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);
                if (allowedExtensions.includes(extension.toLowerCase())) {
                    if (extension === 'json') {
                        let type = key[key.length -1];
                        if (!type.includes('points')) {
                            acc['geometry'] = await getDataFromUrl(`${server}/${current.Key}`);
                        }
                    }
                    if (extension === 'txt') {
                        acc['info'] = await getInfo(`${server}/${current.Key}`, allowedtxtKeys);
                    }
                }
                /**
                 * csv to be defined.
                 */
            }
        }
        return acc;
    }, {});
}

module.exports = {
    getList,
    getDetailsById,
    getXmlInfo
}