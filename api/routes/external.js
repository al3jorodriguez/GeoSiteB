const express = require('express');
const router = express.Router();
const cache = require('memory-cache');
const { parse } = require('papaparse');

const { getList, getDetailsById, getXmlInfo } = require('../services/external');

const CACHE_DURATION = +process.env.CACHE_DURATION;

router.get('/xml', async(req, res) => {
    try {
        const xml = await getXmlInfo();
        return res.status(200).json(xml);
    } catch (error) {
        return res.status(500).json(error.message);
    }
});

router.get('/list', async(req, res) => {
    try {
        const key = '__express__' + req.originalUrl || req.url;
        const cachedResponse = cache.get(key);

        if (cachedResponse) {
            return res.status(200).json(cachedResponse);
        }

        const list = await getList(['Title']);
        cache.put(key, list, CACHE_DURATION);

        return res.status(200).json(list);
    } catch (error) {
        console.log(error);
        return res.status(500).json(error.message);
    }
});

router.get('/details/:id', async(req, res) => {
    try {
        const data = await getDetailsById(req.params.id);
        
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json(error.message);
    }
});

module.exports = router;
