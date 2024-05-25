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

const getInfo = async(url, descriptionRequired) => {
    const textContent = await getDataFromUrl(url);

    const lines = textContent.split('\n').filter(line => line.trim() !== '');

    const data = {};

    lines.forEach(line => {
        const [key, ...value] = line.split(':').map(item => item.trim());

        /**
         * not all elements have the same structure in the description.
         * So, It's necessary to define one.
         */
        if (value.length > 1 && key === 'Description' && descriptionRequired) {
            let last = null;
             const result = value.reduce((acc, current, index) => {
                if (index === 0) {
                    acc[current] = null;
                    last = current;
                } else if (index > 0 && index < value.length - 1) {
                    const lastIndex = current.lastIndexOf(".");
                    const next = current.substring(lastIndex + 1).trim();
                    const content = current.substring(0, lastIndex).trim();
                    acc[last] = content;
                    last = next;
                } 
                else acc[last] = current;

                return acc;
            }, {});
            
            data[key] = result;
        }
        else if (key !== 'Description') {
            data[key] = value[0];
        }
    });
    return data;
}

/**
 * SERVICE FUNCTIONS
 */

const getList = async() => {
    const xml = await getXmlInfo();
    const imgExtensions = ['jpg', 'png', 'jpeg'];

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
                    const showDescription = number?.[0] == 2111174670;
                    acc[number[0]]['info'] = await getInfo(`${server}/${current.Key}`, showDescription);
                }
                 /**get centroid from polygon */
                if (extension === 'json') {
                    const polygon = await getDataFromUrl(`${server}/${current.Key}`);
                    const centroid = turf.centroid(polygon)
                    acc[number[0]]['geometry'] = centroid.geometry;
                }
            }
        }
        return acc;
    }, {});
    /** Convert object into array */
    const data = [];
    for (const key in obj) {
        data.push({
            id: key,
            img: obj[key]['img'],
            info: obj[key]['info'],
            geometry: obj[key]['geometry'],
        });
    }
    return data;
}

const getDetailsById = async(id) => {
    const xml = await getXmlInfo();
    const allowedExtensions = ['txt', 'json', 'csv'];
    return await xml.ListBucketResult.Contents.reduce(async(accPromise, current) => {
        const acc = await accPromise;
        if (+current.Size > 0) {
            const number = current.Key.match(/\d+/);
            if(number?.[0] === id) {
                const key = current.Key.split('/');
                const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);
                if (allowedExtensions.includes(extension.toLowerCase())) {
                    if (extension === 'json') {
                        acc['geometry'] = await getDataFromUrl(`${server}/${current.Key}`);
                    }
                    if (extension === 'txt') {
                        acc['info'] = await getInfo(`${server}/${current.Key}`, id == 2111174670);
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
    getDetailsById
}