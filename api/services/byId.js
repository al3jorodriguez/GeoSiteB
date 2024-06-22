const { getXmlInfo, getDataFromUrl, getInfoFromTxt, parseCsvToJSON, getMostRecentData } = require('./utils');

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
                    if (!acc.hasOwnProperty('prefix')) {
    
                        acc['prefix'] = prefix;

                        if (prefix === 'ma') {
                            acc['species'] = [{
                                name: 'Soleidae',
                                icon: `/assets/icons/cards/species/ma/soleidae.svg`,
                                legend: '/assets/icons/charts/ma/soleidae.svg',
                                quantity: '29'
                            }, {
                                name: 'Acanthuridae',
                                icon: `/assets/icons/cards/species/ma/acanthuridae.svg`,
                                legend: '/assets/icons/charts/ma/acanthuridae.svg',
                                quantity: '64'
                            }, {
                                name: 'Lutjanidae',
                                icon: `/assets/icons/cards/species/ma/lutjanidae.svg`,
                                legend: '/assets/icons/charts/ma/lutjanidae.svg',
                                quantity: '43'
                            }, {
                                name: 'Engraulidae',
                                icon: `/assets/icons/cards/species/ma/engraulidae.svg`,
                                legend: '/assets/icons/charts/ma/engraulidae.svg',
                                quantity: '6'
                            }, {
                                name: 'Sphyraenidae',
                                icon: `/assets/icons/cards/species/ma/sphyraenidae.svg`,
                                legend: '/assets/icons/charts/ma/sphyraenidae.svg',
                                quantity: '121'
                            }, {
                                name: 'Chaetodontidae',
                                icon: `/assets/icons/cards/species/ma/chaetodontidae.svg`,
                                legend: '/assets/icons/charts/ma/chaetodontidae.svg',
                                quantity: '72'
                            }]
                        }
                        else if (prefix === 'fw') {
                            acc['species'] = [{
                                name: 'Artiodactyla',
                                icon: '/assets/icons/cards/species/fw/artiodactyla.svg',
                                legend: '/assets/icons/charts/fw/artiodactyla.svg',
                                quantity: '29'
                            }, {
                                name: 'Rodentia',
                                icon: '/assets/icons/cards/species/fw/rodentia.svg',
                                legend: '/assets/icons/charts/fw/rodentia.svg',
                                quantity: '64'
                            }, {
                                name: 'Primate',
                                icon: '/assets/icons/cards/species/fw/primate.svg',
                                legend: '/assets/icons/charts/fw/primate.svg',
                                quantity: '43'
                            }, {
                                name: 'Eulipotyphla',
                                icon: '/assets/icons/cards/species/fw/eulipotyphla.svg',
                                legend: '/assets/icons/charts/fw/eulipotyphla.svg',
                                quantity: '6'
                            }, {
                                name: 'Chiroptera',
                                icon: '/assets/icons/cards/species/fw/chiroptera.svg',
                                legend: '/assets/icons/charts/fw/chiroptera.svg',
                                quantity: '121'
                            }, {
                                name: 'Carnivora',
                                icon: '/assets/icons/cards/species/fw/carnivora.svg',
                                legend: '/assets/icons/charts/fw/carnivora.svg',
                                quantity: '72'
                            }]
                        }
                    }
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
                            acc['timeSeries'] = await getMostRecentData(`${server}/${current.Key}`, prefix);
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