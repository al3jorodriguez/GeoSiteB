const { 
    getXmlInfo, 
    getDataFromUrl, 
    getInfoFromTxt, 
    parseCsvToJSON, 
    getDataListSeries,
    getMostRecentYear
 } = require('./utils');

const server = 'https://os.zhdk.cloud.switch.ch/edna';

const imgExtensions = ['jpg', 'png', 'jpeg'];
const fileExtensions = ['txt', 'json', 'csv'];
const allExtensions = [...imgExtensions, ...fileExtensions];


const getById = async(id) => {
    const xml = await getXmlInfo();
    
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
    const queries = [];
    const keys = [];
    const result = {};
    xml.ListBucketResult.Contents.forEach(current => {
        if (+current.Size > 0) {
            const number = current.Key.match(/\d+/);
            if(number?.[0] === id) {
                const key = current.Key.split('/');
                const [ prefix ] = key?.[0]?.split('_');
                const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);
                // evaluates if extension is valid
                if (allExtensions.includes(extension.toLowerCase())) {
                    // set group if it has one
                    if (!result.hasOwnProperty('prefix') && prefix) result['prefix'] = prefix;

                    //get information from id
                    if (extension === 'json') {
                        const file = key[key.length -1];
                        if (!file.includes('points')) {
                            queries.push(getDataFromUrl(`${server}/${current.Key}`));
                            keys.push('geometry');
                        }
                    }

                    if (extension === 'txt') {
                        queries.push(getInfoFromTxt(`${server}/${current.Key}`, allowedtxtKeys));
                        keys.push('info');
                    }

                    if (imgExtensions.includes(extension.toLowerCase())) {
                        result['img'] = `${server}/${current.Key}`;
                    }

                    if (extension === 'csv') {
                        const file = key[key.length -1];
                        /** mammal species info */
                        if (file.includes('taxa')) {
                            queries.push(parseCsvToJSON(`${server}/${current.Key}`));
                            keys.push('taxa');
                        }
                        /** time series line chart */
                        if (file.includes('time_series')) {
                            queries.push(getDataListSeries(`${server}/${current.Key}`));
                            keys.push('time');
                        }
                    }
                }
                
            }
        }
    });

    const data = await Promise.all(queries);

    // info to show species info
    const prefixes = {
        ma: ['Planktonivores', 'Herbivores', 'Invertivores_scavengers', 'Omnivores', 'Large_piscivores', 'Small_piscivores'],
        fw: ['Artiodactyla', 'Rodentia', 'Primate', 'Eulipotyphla', 'Chiroptera', 'Carnivora']
    };

    // time series line chart legend
    const legend = {
        ma: ['Climate', 'Productivity', 'Biodiversity', 'Human Activities'],
        fw: ['Climate', 'Vegetation', 'Biodiversity', 'Human Activities'],
    }

    if (result.prefix) {

        result['species'] = [];
        for (const p of prefixes?.[result.prefix] || []) {
            result['species'].push({
                name: p,
                icon: `/assets/icons/cards/species/${result.prefix}/${p.toLowerCase()}.svg`,
                quantity: '--' // search value
            })
        }
        
        for (const [index, d] of data.entries()) {
            if (keys[index] !== 'time') {
                result[keys[index]] = d;
            } else {
                const mostRecentYear = getMostRecentYear(d, result.prefix);
                result[keys[index]] = {
                    series: d,
                    mostRecentYear,
                    legend: legend[result.prefix].map(l =>({
                        name: l,
                        icon: `/assets/icons/charts/legend/time-series-changes/${l.toLocaleLowerCase().trim().replace(' ', '-')}.svg`
                    }))
                };

                const dataYear = d.find(_d => _d.Year == mostRecentYear);

                result.species = result.species.map(specie => ({
                    ...specie,
                    quantity: dataYear?.[`${specie.name}_index`] || '--'
                }));
            }
        }
    }

    return result;
}



module.exports = {
    getById
};