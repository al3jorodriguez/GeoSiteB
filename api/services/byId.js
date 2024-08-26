const { 
    getXmlInfo, 
    getDataFromUrl, 
    getInfoFromTxt, 
    parseCsvToJSON, 
    getDataListSeries,
    getMostRecentYear,
    getRichnessData,
    getRichnessValue,
    getIndexData,
    getIndexValue
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
    return await xml.ListBucketResult.Contents.reduce(async(accPromise, current) => {
        const acc = await accPromise;
        if (+current.Size > 0) {
            const number = current.Key.match(/\d+/);
            if(number?.[0] === id) {
                const key = current.Key.split('/');
                const [ prefix ] = key?.[0]?.split('_') || 'default';
                const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);

                if (allExtensions.includes(extension.toLowerCase())) {
                    if (extension === 'json') {
                        const file = key[key.length -1];
                        if (!file.includes('points')) {
                            acc['geometry'] = await getDataFromUrl(`${server}/${current.Key}`);
                        }
                    }
                    if (extension === 'txt') {
                        acc['info'] = await getInfoFromTxt(`${server}/${current.Key}`, allowedtxtKeys);
                    }
                    if (imgExtensions.includes(extension.toLowerCase())) {
                        acc['img'] = `${server}/${current.Key}`;
                    }
                    if (extension === 'csv') {
                        const file = key[key.length -1];
                        if (file.includes('taxa')) {
                            acc['taxa'] = await parseCsvToJSON(`${server}/${current.Key}`);
                        }
                        if (file.includes('time_series')) {
                            const series = await getDataListSeries(`${server}/${current.Key}`)
                            
                            acc['time'] = {
                                series,
                                mostRecentYear: getMostRecentYear(series, prefix),
                                legend: [{
                                    name: 'Climate',
                                    icon: '/assets/icons/charts/legend/time-series-changes/climate.svg',
                                }, {
                                    name: 'Vegetation',
                                    icon: '/assets/icons/charts/legend/time-series-changes/vegetation.svg',
                                }, {
                                    name: 'Biodiversity',
                                    icon: '/assets/icons/charts/legend/time-series-changes/biodiversity.svg',
                                }, {
                                    name: 'Human Activities',
                                    icon: '/assets/icons/charts/legend/time-series-changes/human-activities.svg',
                                }],
                            };
                            if (!acc.hasOwnProperty('prefix')) {
    
                                acc['prefix'] = prefix;
                                const richnessData = getRichnessData(series, prefix);
                                const indexData = getIndexData(series, prefix);
        
                                if (prefix === 'ma') {
                                    acc['species'] = [{
                                        name: 'Planktonivores',
                                        icon: `/assets/icons/cards/species/ma/soleidae.svg`,
                                        quantity: getRichnessValue(richnessData, 'Planktonivores'),
                                        index: getIndexValue(indexData, 'Planktonivores'),
                                    }, {
                                        name: 'Herbivores',
                                        icon: `/assets/icons/cards/species/ma/acanthuridae.svg`,
                                        quantity: getRichnessValue(richnessData, 'Herbivores'),
                                        index: getIndexValue(indexData, 'Herbivores'),
                                    }, {
                                        name: 'Invertivores Scavengers',
                                        icon: `/assets/icons/cards/species/ma/lutjanidae.svg`,
                                        legend: '/assets/icons/charts/ma/lutjanidae.svg',
                                        quantity: getRichnessValue(richnessData, 'Invertivores_scavengers'),
                                        index: getIndexValue(indexData, 'Invertivores_scavengers'),
                                    }, {
                                        name: 'Omnivores',
                                        icon: `/assets/icons/cards/species/ma/engraulidae.svg`,
                                        quantity: getRichnessValue(richnessData, 'Omnivores'),
                                        index: getIndexValue(indexData, 'Omnivores'),
                                    }, {
                                        name: 'Small Piscivores',
                                        icon: `/assets/icons/cards/species/ma/sphyraenidae.svg`,
                                        quantity: getRichnessValue(richnessData, 'Small_piscivores'),
                                        index: getIndexValue(indexData, 'Small_piscivores'),
                                    }, {
                                        name: 'Large Piscivores',
                                        icon: `/assets/icons/cards/species/ma/chaetodontidae.svg`,
                                        quantity: getRichnessValue(richnessData, 'Large_piscivores'),
                                        index: getIndexValue(indexData, 'Large_piscivores'),
                                    }]
                                }
                                else if (prefix === 'fw') {
                                    acc['species'] = [{
                                        name: 'Artiodactyla',
                                        icon: '/assets/icons/cards/species/fw/artiodactyla.svg',                                
                                        quantity: getRichnessValue(richnessData, 'Artiodactyla'),
                                        index: getIndexValue(indexData, 'Artiodactyla'),
                                    }, {
                                        name: 'Rodentia',
                                        icon: '/assets/icons/cards/species/fw/rodentia.svg',
                                        quantity: getRichnessValue(richnessData, 'Rodentia'),
                                        index: getIndexValue(indexData, 'Rodentia'),
                                    }, {
                                        name: 'Primate',
                                        icon: '/assets/icons/cards/species/fw/primate.svg',
                                        quantity: getRichnessValue(richnessData, 'Primate'),
                                        index: getIndexValue(indexData, 'Primate'),
                                    }, {
                                        name: 'Eulipotyphla',
                                        icon: '/assets/icons/cards/species/fw/eulipotyphla.svg',
                                        quantity: getRichnessValue(richnessData, 'Eulipotyphla'),
                                        index: getIndexValue(indexData, 'Eulipotyphla'),
                                    }, {
                                        name: 'Chiroptera',
                                        icon: '/assets/icons/cards/species/fw/chiroptera.svg',
                                        quantity: getRichnessValue(richnessData, 'Chiroptera'),
                                        index: getIndexValue(indexData, 'Chiroptera'),
                                    }, {
                                        name: 'Carnivora',
                                        icon: '/assets/icons/cards/species/fw/carnivora.svg',
                                        quantity: getRichnessValue(richnessData, 'Carnivora'),
                                        index: getIndexValue(indexData, 'Carnivora'),
                                    }]
                                }
                            }
                        }
                    }
                }
            }
        }
        return acc;
    }, {});
}

module.exports = {
    getById
};