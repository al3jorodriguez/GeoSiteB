const { getXmlInfo, getDataFromUrl, getInfoFromTxt } = require('./utils');
const turf = require('@turf/turf');

const server = 'https://os.zhdk.cloud.switch.ch/edna';

const imgExtensions = ['jpg', 'png', 'jpeg'];

const getList = async(txtKeys) => {
    const xml = await getXmlInfo();
    
    const errors = [];

    const obj = await xml.ListBucketResult.Contents.reduce(async(accPromise, current) => {
        const acc = await accPromise;
        /** Folder is not empty */
        if (+current.Size > 0) {

            const key = current.Key.split('/');
            const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);

            const number = current.Key.match(/\d+/);
            // condition to check if id is valid (ids with length > 6)
            if (number && number.length && number?.[0].length >= 6) {
                if (!acc.hasOwnProperty(number[0])) acc[number[0]] = {};

                if (!acc[number[0]].hasOwnProperty('prefix')) {
                    const [ prefix ] = key?.[0]?.split('_') || 'default';

                    acc[number[0]]['prefix'] = prefix;
                }
                /**only elements with image are shown */
                if (imgExtensions.includes(extension.toLowerCase())) {
                    acc[number[0]]['img'] = `${server}/${current.Key}`;
                }
                /**get description from element */
                if (extension.toLowerCase() === 'txt' ) { 
                    acc[number[0]]['info'] = await getInfoFromTxt(`${server}/${current.Key}`, txtKeys);
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
    const ma = [];
    const fw = [];
    for (const key in obj) {
        if (obj[key]['geometry'] && obj[key]['img']) {
            const element = {
                id: key,
                img: obj[key]['img'],
                info: obj[key]['info'],
                geometry: obj[key]['geometry'],
                prefix: obj[key]['prefix'],
                species: obj[key]['species'],
            }
            if (obj[key]['prefix'] === 'ma') {
                ma.push(element);
            }
            if (obj[key]['prefix'] === 'fw') {
                fw.push(element);
            }
        }
    }
    console.error(errors);
    return [...ma, ...fw];
}

module.exports = {
    getList
};