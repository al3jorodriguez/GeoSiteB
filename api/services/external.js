const axios = require('axios');
const xmls2js = require('xml2js');
const turf = require('@turf/turf');

const server = 'https://os.zhdk.cloud.switch.ch/edna';

const imgExtensions = ['jpg', 'png', 'jpeg'];
const fileExtensions = ['txt', 'json', 'csv'];
const allExtensions = [...imgExtensions, ...fileExtensions];

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
    

    const errors = [];

    const obj = await xml.ListBucketResult.Contents.reduce(async(accPromise, current) => {
        const acc = await accPromise;
        if (+current.Size > 0) {

            const key = current.Key.split('/');
            const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);

            const number = current.Key.match(/\d+/);
            if (number && number.length && number?.[0].length >= 6) { // id is valid
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
        if (obj[key]['geometry'] && obj[key]['img']) {
            data.push({
                id: key,
                img: obj[key]['img'],
                info: obj[key]['info'],
                geometry: obj[key]['geometry'],
                prefix: obj[key]['prefix'],
                species: obj[key]['species'],
            });
        }
    }
    console.error(errors);
    return data;
}

const getDetailsById = async(id) => {
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
                const extension = key[key.length -1].substring(key[key.length -1].lastIndexOf('.') + 1);

                if (allExtensions.includes(extension.toLowerCase())) {
                    if (!acc.hasOwnProperty('prefix')) {
                        const [ prefix ] = key?.[0]?.split('_') || 'default';
    
                        acc['prefix'] = prefix;

                        if (prefix === 'ma') {
                            acc['species'] = [{
                                name: 'Soleidae',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAiCAYAAAAzrKu4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAITSURBVHgB7ZbNa5NBEMaf2U3SoqDtoQgqWmmluXouSGPNH1DwIiJeSm/Cm5uCl3gSlKR60VAQEZGInkQQbYLQKj0YQfDStLVV9Ny+pCRt07w7nX5S+h2aNIXu77C77Mfsw8zuzgIWi8ViOVrQbhOynx4FtfKHmThIhGOyoomB48w8LO0P5CGPkhgKqCI8Qy1hd4goarBPthU2kuoNy+g9mXAZ5VkUmfyTQD/Y4KvROtMWuj2MMtkk7Hf/g5Oeqn8qA9dRIRg8KNX7gMa35o7I0F7WrAnLpmNnlNLdxOwwowHVY0yEJvwK7y6EIn+wk7DRdLxPmt04aAhjMIj+H5xKng01dknoO7X4qOWKE6fR1JNrIPMWNUI8Y6TIrY+SRC2hWJmHqCFyw9XGo8OEW0oxcjhkiNDXPsx7Dvv1R3FpHWoB4594KEMsLyJ4lon+Fksmtnr44xJZB7Wh72Kn07OxUy0WrXP6Dhl+hgNCHt+CZI4XUrdvJWp5zjqy/bEeUuqudDajOrhsOGmIngevOt93mrhlShpPP75ZAt+vhEC5dZKi8FmDX70ccN9Eo3vLo9vmykwm4T8xWbihfBSSW9IhXec2bcooiQFXrMj+aFrpnl6yK48nMyXyOZO81BVxUSa7/i5W+ZXqPVXvU6fJo0ZxQh1jfqR1ID9BKx6Y+BJvYNbni4GZ8bb2Qr4SPwyLxWKxVIEFSDjD1xFZVssAAAAASUVORK5CYII=',
                                quantity: '29'
                            }, {
                                name: 'Acanthuridae',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAiCAYAAADcbsCGAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJ8SURBVHgB7ZVfSFNRHMd/v3O3WZk2KAsfCsVNEfpj4EP0YIpCJk0iCqyHngx6KG0GPRgEkVAR6rSggvVST+WDb9WYZYRFvRQR2GhpKxstalbOje7+nF+/BeraljSbDOF+4HLv7w/nfO85534vgIaGhoaGxpIDM2keH7KtixCYFR2WgSSTRFyPRKu5lI9IKkh8JQCc6lToeeXeTj/8J/OKG73XW2wwCAtI2UyImzi1Af6NABEM6BU6W1pn9UAGeIevrQmBajLXtT1NK25iuMekkujjCRo4NMDCUXmCLlP98a75mlwjFwqUiKEZYtiKAooiKu2u3GX1pIh74+w7hoK6+VEP2ULAQ17FgyU11k8zqS8j1wu+qdP7AMjCoYWF6Pj+RI1Iy8bGjsl4z6y4F4O9xoKVcI4EHoFFABE8iHI/SKVaIu1BgloCyJtrgFumuvYDyId3LsW4HtgqdAS3ObsZcgLazfXth1Oy4/dtNRLwLgGtgJyAN1nYoXQVsVwvXvMyf4ZcQbTN57iYn64kQvTTCJSZ3y2Qj3z9SMkimIM6g53c/XnJJVG246TbKPTsYXSe4ygsEnyeH00LKiGh38q+eZkz72dqEqhlbEK6Rp09DfCH7gRcjkulqI+dQklN/NUUQ1ZBO7veUXNTmxqPfI4b+QFlsgUEtsa3drYL0YeAg1EMn/7rdo4NdZdHSVcrFNjCv6rt/BpVadqmeEm8bNbv2AEiPPQqNtEqjo1JfX6SNEAxebWi8cTL5EHiNlZoVKp5rMJoMPqswtLh/S0UMuDt4ytrISwLw+r3YOXOTl+iJyXivtNfhMuwPBYBf0D9+qG6+UwINDQ0NDQ0ssYvq4/lzz6BZxcAAAAASUVORK5CYII=',
                                quantity: '64'
                            }, {
                                name: 'Lutjanidae',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAiCAYAAAAzrKu4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALfSURBVHgB7ZVPSBRxFMff++0sBZVaUhvlIW2nQis6BGWE+C8FoVNFHYoKCjzpKnaoy7rQRVRWzbIoqEuXDp7CWPwzHZRaCDrkP1zRS4GEkamkODO/15vVXVRWcWU3I+YDu7/fvHnz+33n/d57A2Dzn4CwCUJd/lx0YBmhaFfzKz5DEohLWEhryQDDLAGBLyLPElBQgHh9uLCiFREJEkRcwka6/bcQ8BFPd8ZYaUASPD3yo69tzHU+S+p0BlAcBJIOCY5BsUA9alnF9Eb2Ge6t27VhYeOaP82Q0MsKcmAzIBhA+FAtqvStt4cuoUYIkY3ri3m5XYdfN1HSDV75HGwyJ1foE1DjLvA0rraPak1XOS/aiGA3e9Uqay0w1Fmfb9DUcyR0J0BPFJLwgIeosIlA/Y5poTSwvTxiE4ifYgoL9firOeyNkLBUXq4MZiPTjx3elBmn8w2XTOlyF8M0hlaEQvN6lYy8PW389B1IDlzEopZAfuBTyEYhyzkAx1Z60IJaXLUtGrGvwdb0uVmjne/kQfLgopY+XNLIomJ44IQ1hIUNB+oz52eNAE9V2HrCRy24RE8Jh7OP/g1RVkid1ihMwiuIsB/+Ht/5FMfXuslJmGqNgrt1Jp91kE1TkEyIvvHfXbXI41KLPVlu8dNp9SuOkLnKc1+ooyUlnH38Ub7MR3kJUaisOJ2NAhbz7wAkGF77lbvIcztyPao9dkupd7L9UNRJUsG6nZM0rzICu9LQcOxFxZGKRCeJ6NniDjQJJmpC4DtJpJMQvwXhnCnNGSI5ryjC6uKnYyzbz1E7sdww1tXkMhEbeMfri+LxXtwtPdTdzNVLJUuXQd7k7Jq+nU1V/ALsi67wfkRfFhxUl1NYPRDLf4QLkZvtff7amHELGww0H3cq9J6n6fx7y8IuQoKxGr2I8xnILq3sl1Je4+kkv90QJIECn8+IW5jF0QvVXajLXF2nJ2BjY2NjY2OzJfwBGDEPvkHiOGUAAAAASUVORK5CYII=',
                                quantity: '43'
                            }, {
                                name: 'Engraulidae',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAiCAYAAAAzrKu4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAMxSURBVHgB7ZVNbExRFMfPvfe9KaVoYyE+ohIR4luE1kcQFlIWUpVY+Ahig0htEKqTMY2oHRErdiLSZpqGRJrUgqRqmohF0zZqxULUhqqmn+/d43/fnZmORn21seD9J/PunfPuOed3z7nvDVGoUKFChfq/JGgC1VR7ZbMS/mVFfGpdWWU7jUOSJkjJRFW5I/VtIWiOZrmFximH/kBNd6rz3Hw/ojzp9ZGORJR/Bua9RBx0QEhWNE59t5UcjcrmpZEVyqVlzHqxZFHIxLORVwipZzLLHGYmCyJgzfJloQWJdiG4haR87fve2+7cGR0lJacHx4JIPopO4/5IKZy3IpYs2ltxKBPyaX3VvIgvtkvijYBYg4RTASWBwiZ5kJQISTHgw3ZXZjQD4mGNuYAaLgY4Fdv6YmUHDJ2sZJvn8ytHuF1Ew3OxfjfcdmHZlGCZ4JvFpZU3REtd1T6teaVQIh8htmtNPkJ6HJw/HsYFc+Fbhp82QIxUDnDYFSYqsBvYYC7NvhToTbslopqNmNhdOAO3ikov3jf+DkBO6IhzVjlTOnXf5wsIUQq7C8gB1MGFh7KJyCay6U10EZSDjZVlqjIpME4jcharMIfvG/r0FojbfJVzeNOec1/SVsl6+Ljj6SXc170TrsUpCNMcF9MeuE02X2TPIdaTsG2M5MCGB4eVhcokyaprqv2oXFC9oMvmNndj/gZ3Pqa5QbzM8YeuJ+vjJRnv5N3oND3ZvYaEO7BGZweFYy8ueSN7I7JnziQTwrZAjGpxAJGCtCOc3qMCtRj7NYnegdbHiW2xJ15LTXwBmnqASSO3mBUk1tzQ0OaVZ6r6ovHq9KFPg6sc11mLM7cIUQsRqNBCWKD0w2B/Z0BtqVKvihHZ1mJxs8j1TheVxHpoDDXVV+c53tBROOxHvAJEe/DDN39zTXQhjlsBnrN8VLQAD0iO0JwLoDPg+wCmhNbyHQ6cAtYRwBVmnTUD+7C/1Tu/LRbz6BeEfAWukOu10uq3/5LMOy653C3HbHVx2aWDafuzxMX5iiY1pqvpa7q3oawiZlv/F2XKP9qWrIuffJ6Iv2xOxI9RqFChQoUK9W/oK2LDebAA218WAAAAAElFTkSuQmCC',
                                quantity: '6'
                            }, {
                                name: 'Sphyraenidae',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAhCAYAAABa+rIoAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJrSURBVHgB7ZRfaFJRHMd/v3PV3Y2mkvUSVkr0vJ5MK9nsQWIvi0mD2KJ6Xw8FEQtNLrpFrMc9FuslAm02InqLKGTq9hJED77MCQsiCMJi/r3n9LtqsMJwyBgNzgf1eM/5nt/v+/udey+ARCKRSCSS/4ZE4pKSXn4wCLtMYTGqGiODHllNxS4cU4Y+mngt0k0rhMDsUuxhJhkb6abNJef8X6yW99nXUSv+vfiWXFtsYFVUqJRzsFV2OBS38+eB71gdFGVQUR1o7kHRWKS0pwGhJDgP1rlp/c2n6jdN0/gf8V5E7f3c/Ij+huhbrOoiMDwRKXQqIJOKawqyGV3wxJlQZLKZKPc8Pg0MbaQwkvmFADv0AkKD9hbpOD7TyAGxTnMnKa6rreA0v4BonveG7mz+3mbcHkfZ0GNEuGpcM2QjnvG77zD3ct7NG5UJFBik+fOwVwgwulek7vwgN4eoc75WfVAQ/fVT3lGtZNKr1THGMEBqpE+JVq2wFyC46dctmkbFNs9iwzDWkrRZScQ9ZjM6OBdBEhykJSdtOUGC47Cb0NHTgadpzCNja6jrRR3hHCLeI2dNP0yBs56L4RXsFiu9HD3SJ8xOzvEwIPcJzuyI4hoXsMUY5KloKwVV6LmnzotWPBKQAZ0S5qnQMk34qSeutrvNeqU27J/U1rfnySbjY0KBJ7TTTk1Z8IXCN7qa60RuafYVJbV5Q2H/TvTGG0AdtMyR55sM4alnPDzVSZd5dt+FfTxGRU5ZVHCZoAd4jU1zkz66U33gulah4dZaavYD3TYD/9L5Ls9s0HBlNRG9jV+hAhKJRCKR7D9+AQTD7cLXWrjPAAAAAElFTkSuQmCC',
                                quantity: '121'
                            }, {
                                name: 'Chaetodontidae',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAhCAYAAABX5MJvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANKSURBVHgB7ZZdSBRRFMfPmZk1SjMpigyEzQgi+tBKWMMoETIhzG8EIYleDCpSH4pSt1VXiSR66bVAA2v9fKpAKLPQXT9ShOolgqQ3ycT8Wnfnns5srqWt67rNEoW/h527996Z+7/nnHvOBVjjX6P7mXnz6/ZbG7X2m3bzDtAZKaBJk4bkpIyr33raao1OlyFZ6+tqsEaDTgQkAhEKPE8hzG5yvepprrngXDcx7WiuygAdQH+DDlvVzrAp91dnpDKoSlKmLKgThFSMkkghwBFB6gfk52iYuzs93TINoRDR22aNU90iFSWpiK3RT0Q5/Bwngqj512cAyQECx2UD1iljzrfx5yzjoKeIbtud9ZI8PUwA23liBKz8uXYA6hDhGx4dPVUyBgHiX0RT1WlZxoafOw8cJBgSCAOKIu4lnKkY9DfXb2COh2/qYCsE5WtCiOMdnldVacDRUp0JwYrYMjtxFwj+LC+QZhSqg2BEOFqtxeyGItAFjOUgT4HViNCSEglxDXRECHF80Rq2qvTe1mpP/lF8vSCRepMQt4GuYKK3ZW+zVoKgcsFnvr/F+vw3EX1N1jSVqBB0h6LnBdSxgNJ5YaiSOLnoiPa0mY1IYS+AyAg6IyHUCeTkxhZYNEB0cZElkAzloRCgwaYv1U7K0n5O+yj/EEOYut9QwTNKIGSgz8TICh6idhJQqJxu4SD8DYScKpGYi2c9+yDEcM4ZZXd0Lu1H2e2WZJztYsek8f8WCCHsjK3KnCuXQzQXgfq8/ULlGvzrRHtL9RVEvMQxEgshwRVjyrZ81lraNYHz+YGErBv1PoPFYatMREW+zBGdDzrBC009GXZFWiwW4WNseXoaa40gixMok1YFjTx9N3t3PQQBV+PHidll+csIDBy7rWYvi7Jz03PzZj+/JwFDXIG0bKjwSkk+BfBtzD3jOnyswPLR13hAF10vprzr77imWBc+TrSHy/R9U1ZZcoTbxVUSHdqCC+N8JeGfp+B0xS8nwLMZCAJ7q7WJFeR4/giqN+WWe2rN4ANzlDNc3gWy3MwnYMQAcPZQdtmnlb63Kkt4UZS5Qs7xt3mnX0AGp7dfu+Sa8ioGcBKPCBL9cyASINS8bKyO8QTvGv8T3wFkq07E7pixOwAAAABJRU5ErkJggg==',
                                quantity: '72'
                            }]
                        }
                        else if (prefix === 'fw') {
                            acc['species'] = [{
                                name: 'Artiodactyla',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAhCAYAAAC4JqlRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUJSURBVHgBtVdrbFRVEJ45524fPKQUCSAKlPRBGxJIAyTFCmy3yEvrIyrEBBIiiYlCu2uMoqIENQYJZZdqEHyEH8ZEfwERBSnL0ogNQQyQNBZcaqtitUhpobTe7d5zxrlbit2yG7Zs9/tz75mZM+c7M3NeCMOIX/3bp4Z6JUoHzswvdx9MpI8BSaI54J1mRhxJS3Z3XzfS0+cBWg+yKCECAu4SjUffG/fH4R3ZOU5Pi0PjLlJqy5QVGztRqCoUOPFiXfUDtt35I9UVvwc+mDPsBAwasSaUjguCfm8xITYKxLlBv28ve/STplVkOdJsu9HZo46GtHrT/g/Wehc11e4ZMywEUMhzpHEh/62TmrYBQr0wxAGtoYxlGUqFi227yXOe7wGCzghpA86SMNdE+YEkwDNyc7jfIoAvuOnKc7mLbPnFwM6loOFtKfQzRjpdN03x8ZkrP6ycO77IofVYd0d3R82cii09tu1dR8BG3mKPT/ZSMSJM4WZho796vi3PdVYdJqTasIL6kCmatAJf8bgFD4d11ioNikZnjpnf7yMpAjZylnlacsvcjyHBKkly+4VaX2lEobFVEqzXAJ1aKP6oJzgVTwHIldrCi/39k0rBYAS/rRmPadqtQRciinJOw9MCtFJCHEK7bgFaqBdWFyxzn0gJgSgy/ppHgXQ1x/hPnvmiiFCTk9N2fKBd0imIh7Q04wQhOIggkpLWtg44Ut+wL3jUuz/o37m63y5lEbDRFPA9wsvya/u/q9uEwMmfocJV3DcwcjoAalJGoKl26xglM45zcc6OZ0NA51KWAhKZW+MPTt/zTrYo3+WZnXQETp/e4xj3T89ky1BjSchZkkS+QprKjp+N0yUQEo6Kmc4Xb9iN2whwkZRw8axBwIe4mcnJ6mLG9hIy2Lidi6qNw3YtMg/EHASaxbIsSBQ887yyyrr+5q3juDmwbWJYpX3OlMqjWLH3gUztLw3QESQHo29w7zRFeJIrcwKkFPibpW80DJREipAHX6AJwpBiEOmvCstfb7+NAJliP1fsR5BKEBy3QmrXYHFUuoPHfIFb2+bwoZNAv5bveml3LGXUPoCadsKwgur+taySeIPbiLqUksCcpMv6Jvj8fb/A5dl4J7sIgWv1O7Ivm/INrhJPFCE+PvkEW8+3nhUcHydLZkTrqZvlIc5j9mDHiDQWEgDyEswKa7jEG8/IwUq+UKybXu7+rL9t7xWkR6SbYMLVLnW19PFXu2z5L37fO0xik0bagYgBnv5abj9pHzj8SliW49xwPh4BI0Q4QQKMJKKzXBGbeDXkMS8vd74w3fX/4DZynK/8HXMW/BCIxEMaHxYs3NDMooPnv/OWSYm7LVT1fFGZlLe8MhSrrxAWZfLg3ZYFy/PLPN/wDKpsRThES2EIsNM1o2/wCGYs8RwzJM1jxRVwYEm8fgIdMoNncKpoqeev5sDeDO6Qxc72FfJdDxIffBSHvGGwnB8tnVwLVXwnfCE+AY0jOHg/9nVYa2qgTzkKrTAE8IE0VSs6EEuX6/Ic4kdLSUOtb0pMAtw7ly+QPf0CZakvOSX3wdBwr0D5Uzwlb8G70yU8F5MAkXIbgpfbTRQueZkdUXZg8+bEH66Ik/IWV56Jp5ZaNrLR6pgEOAJtpqL2aH9Yd39pVikkCqJ77CtYPLUl4BJpnRaTgBWitVwIl6OkpviEiU2GxBm8aynHtHjaAlflKeyVRbF0/wGLRABBqj5p8QAAAABJRU5ErkJggg==',
                                quantity: '29'
                            }, {
                                name: 'Rodentia',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAhCAYAAABX5MJvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAP/SURBVHgB7VZdaFRHFD5n7k/WrI1JaiOmlCZtTNqaFiqhRSrdStJUS9OG0obavrQgFFoKbl6kJSBBCgWLW39qiy+hUCjkoRSJsBh3Y1vBP2JE8mCUNdEHhahJNFH35945nvE3MXvvnY36In6we+/OfHPmO2fOnLMAT/A44WQitmYwvrkcHgAID4Dxga7Si2OX9yPCs1LSNkvg7hxQRDrZP19qXn9O1462iBPJX+pMopa0sH+vX/ntlBob2rvlM4H01zRamgBcQDpwZWrio4YPO6/p2BY6pKG+nxcaBP8S4KaQK5vUmDoCRFrKfrjTqCH2KoyETSXhsn9GErFlRBToqKeIwe5ueyix+Y1TidhaQeYBHlqkxiU4y9WzflX7GAC9wh8j33re+d0swa7Tya1fQgDyqjzZG3sZEHfw6wo+b3P2IupI52SPbRmb1GbgAz6egdHJTGRF6/pJL86sSKT2bq9FgXt483f6B4fNXYmjeQxjNFxkZ1jAMggAc2or5tsb/Y5lRiiP9+woM63cPn6tujNWuagcngqH7l9XLIFK2MsLbLkO/GEj4pvjI4fsrX/Ek/kIMyJhha6/xY+aewLKoLKiNL9pwjUsoB6I0hAMJIIfUsnYx4EiisA4y/HLgRbI4q/FnDvDHJERrRUEyyFIRLFbnpKAq9nwr7zkDARjHvtYjQQshBwNflEqueV9XxGT5tgeA7j4SCh1CTcaAtbCzQT3AaFKmDogMQoBYEOrScqIrwjF45A9w959YSBtdyR1gE5VRahEkAv5LaBUYw0JeG2gL1bqKSKTzn7CaiN8m3byAq5+WAW6QLTx1m3zT1TCVXy1WmYszcvjQnAqGYuziGYoEFxfRnijCs6RYh/ab0sa131z54fwMETZSxMtrGUbFAh2oErVD35mvFloTf/l2Tvq2zqzxy4tjrJHP6prDoUpeY5DPOU1zY0vrCVCoa2tza1tjHZIciPoUCNriYMOEARv1Os1Te7M66zVyuua2v+veS+a5Gt4EPTgEIn9XpOIoqtgEXdB9KoWDaAfBHkd4VXj6ZIBmIuIwe4NNmh0TQXOh30soT3vJFFv9etfTcxJRPqFStWLg0szql4Frcx9cbYAkNKFnfcPa4toaPg6x4nZH0jkSufZ3hH/rm1eF5+ziJswRDfMFQRnM+nMd/zfYlauBPaFVO9PC0jMW2oLkb16LXvFChk9bGUJFACuNYdtC1qr3o6ezzfvK2K4b0PIofI4hzhy25pUsSadCDKXradAUsw0J7qqV3Z69hTTz45ZtACd66Su00EO4ue89RGScEIYOMqV4AKLMbkrfsqtdz5vutsUxn/SMc5DKA3WZHbq+Q++H4eHCXUs8ASPGDcA+3d4eFpawQoAAAAASUVORK5CYII=',
                                quantity: '64'
                            }, {
                                name: 'Primate',
                                icon: 'data:image/png;base64,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',
                                quantity: '43'
                            }, {
                                name: 'Eulipotyphla',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAiCAYAAADRcLDBAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANCSURBVHgB7ZZLSFRRGID//5w7czVzisKid4RFUQbClLrIkGhRm0irRRRhD4IKahFEZQ03rBYtgpZtipCCgcrFJIWBUr4yrUCjMsQ0o8wKdcbRce49f/+1TCcLzcdAMN9izjn3P4/v3LnnARAjRoxJoKjI43pbdEUnIoRxMKrGJdc8cVm5Rm+F9/Q80OJSXKb5IuRwZoYtsoQAN5lWmdC0Zg2ntIasQJLuN9tTc40OGCUjSpQX5C8SU3AXKGUX0wWK2QRqKjddwW/gDSI6CSgJAds5/0kBBUmpckKHj+sGMrJPvBqTxIMblxKmJ/RsUYAzubgZQWwEIAmjhaCXe9Y481gDcRxCfS2wbG6n230wPKJEvdfj7NH1NZZJmQDqEIfnw/gI8giNQNgi4hz771V3fzYMQ/1Voq4wf0FQwTECPMwz6OPZJMIEQQAhHsgHUpztmRZqyMoyzKFxYf9U3vUs7rasZFKQC0T6RArYsIDOIhvAUgfiu5wzqcSjDZOQpC3n32tc2wmTBItM5+QYWFRc9U1PGybR3WvW8EqfxtkEmGwIUnj17Ku5f35OhESi/2MnEryGKCEF7AgHrIUREu6DV8Ns2ARRgr+PBN5XciIkfgZq7LSstgGighDry+94ZkVIoJQBO21saYOoQDQbzS5/hIQjHK610z1b10GUeO8Cl4yQICkJoghvinWrdhiBCIkwwi6IIojq5UB+8JsA2BpZC/ysW8rOx/m0LBgMUND+Q/vjdjoWCG4BUtVA8df2SaRu87KZyr12IloP07M9xQOxqgKPC+IdMzi7mUj4WOqplKJcISxBUif5+Uo+ztv6JwiYZKes5+eCfeFp4iM+jg+xMD9N5oFq+lTwaOa2i+1DXsDoeOS9kKRLVcSSbu64NGPbmazKuxcXo7J4f6F3aTPMpU869CN877jM8ZvSSRe6E63G+K/OZdJhSZzXWm82LyzkEdvSs/P2Du37n65lXu92OR9XbwKBDrTAKRyYT4qSedDrPNtUrpLCkucycvKM39vaV8Dq2+ef8YhdaTl568csMUDVHWMjL6fdP3rHWk0qn0liidbb99y90/jypzYVN8+lSh3XgpIf0raf8kGMGDH+F74D4TBO4qs1wCAAAAAASUVORK5CYII=',
                                quantity: '6'
                            }, {
                                name: 'Chiroptera',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAhCAYAAACr8emlAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALSSURBVHgB7ZRNSFRRFMfPfW9Gp/xIShSEMJR2tZDCD6xEKmkRlDlYuQkJWgQlEpgx6vh0pkEDKYta2AeCoakzzao2UdDC+agsVxISZBEUZExqfs3MPZ0nPXNqHK+MCxfvt7n3XM4593/PufcC6Ojo6OhsaNhy4+1ja9p8SD6CKJtUW2LAkfHvszz0srRSmYZ1xPvEmgozxsPIWYq2Jkk8wHjIm1+pfI0Q6Hl0tZgZwq1klkZPh4gA3SCFlKJy5SPEwbC7LSuIoXrkeI7MxOjbwVOQeWNhedMbhmiV/E7ja2SQB2I8YAx7Ck40Poc14B1wlIEUPkXTahF/qpw3KBvLllrsG7R3IMNaEASRXyoyN3WI+HoGbHVMgjYQhHybC8oblD9C/+Jz2gcQ0CyYZyocZgeKKy3vYjn5B605yIxjdEUkEAGht9DcUKWZEUEcwAHipMgS7/T2t+zxOm19dEuXDqvO6bAPh1xKCQejW1gcMQ9oXW5HBBZVWIZpuA2iMLafyVIXzU76XPZb2rLPbW+hTlRJIHdRj3aL5VLPhT0l5saxyOUojLiuZczw4DGqqYUxyAZBqIY1jKDP6TqIM0GRjsTJ0L28aiUA/+mOwVB/7SbJsNVBO9fAKoyMfoLkzSaYnplbHHOzM1YLUTe/mxQO1u6K8ccyEMDjst1gCBdj+XwY/wbJSSTw19zimJm+BWKLY3cKKiznYRUMIEC6KbVuYvbnUQS2QOYoJc+icS+1RtZ8crMzF8cVhM2qcfTbf6GK7ASGpvG+kQsggFAFVZ51X9l26IxjQrM9vY4dUgKv44CnKUlatBh6vQFg/D7H+c7iCvu4tu5327bnH2/4DOspcCXwhdXg/5Hwnl5tTmRi9ioYMBzcd/byFMSB8P+0EqxUCdHrdf67ToKH4xWnErdAFcPcQju1s12zmcRuJk4G62Gj4XG2NvucNivo6Ojo6KwbvwE7tgXYWtv9QgAAAABJRU5ErkJggg==',
                                quantity: '121'
                            }, {
                                name: 'Carnivora',
                                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAhCAYAAABX5MJvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANiSURBVHgB7VZNbExRFD7nvjdDpNGKhARhmrDxEyHVTgniLxYSTd+UpCTEwk/8JEIQnRnjhWprwYKVjYVQipYFgggiTKdK66caIlRJhEiY+unMvM49zmvHmE469cJEupgvee/ee+757v3mnHPvG4AMMshgAAOTDU11vpywtK2QKFpmamW34T+gl4imy0fLgsHgjsF2yumxEAHhbSDZTAJfgYQnaBetziL3B0gjukXcPF81ZggYJ5+9Cc5pb2+HxbOnWOGGiams8zQIe0OhtqsV/hLor6twoIzWc38k/DOwk4g+IkInP2EgCEqgH0jirB3pxnSX502frJ4aUJ9zd0SC3XQeB+mF5D0Oj+yIeHLX6KHECTGtWP9CEbWAHdp4fGJQhzHM6fI4KKLkckEcgfRBcI1t/5CttvrrfI7EiXhh+qsrHOogmTVDcz9NdGg4qy+QinKdQ4uQLiA+u/IoMkXXddlLRH8I1B3YSVJWQVpB+5wu7x6zJ6y4FxSXHSSEL5BOEJL/3L61lkXESCcgbSBylnh8XHONTcd9OapVGh+5e1wXW/p3Yg9JnwFFB7ePUYHvfN2V9uFomO+ZJXuazNZyJFDK0O+9oIW3Wx8fEwYigKNU1chylniHO13uXOcyTxEiHkyxnD1wvnzJr4FlEYSiKN4HeM/hPMZqHsQs6hyX+33eUv1HIie/2N2cVEuP42uQPFVfc2CiZRGNNZXZTFsUo7dRxFgbU3PHbPhW7ErFReI09vje4vtnKkdnG6e2i/M7lIS8Zt4ZlkR0oaFxM5rlvwt/h/mFpXpb97qSLnZvBKimFoFPYj73zbZAcx+WYWUCi3nFYkYLaVttLR2KMM9zBIWyfO4q7+tf5sJl3lucmm/cHZuKKpGi3YIRJsR5pbvbODLenqXJ/8fT0XChYqOMRh0CYXe+VuZPnucifcGvlmR7Y+M6m/F23EIhYRMLfccfyUNJLvP4eZlX7L2WUsTdWt8IRdrusoDxvMjDfM1TmexTX7v/Jh/BSbzImd7c8slGO91B4v8liDVG59cNs1dWfjbn+CuLgdryqxyhGfzDNpq2lCJmafrHwLnyzYgCbcFQfV8+ApQqLsqsUKjjRi97WHwTNtqqIH3K09yXEueaL+zNBrRflFFZzemshgwyyGCg4yeTulpxBV2jUQAAAABJRU5ErkJggg==',
                                quantity: '72'
                            }]
                        }
                    }
                    if (extension === 'json') {
                        let type = key[key.length -1];
                        if (!type.includes('points')) {
                            acc['geometry'] = await getDataFromUrl(`${server}/${current.Key}`);
                        }
                    }
                    if (extension === 'txt') {
                        acc['info'] = await getInfo(`${server}/${current.Key}`, allowedtxtKeys);
                    }
                    if (imgExtensions.includes(extension.toLowerCase())) {
                        acc['img'] = `${server}/${current.Key}`;
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