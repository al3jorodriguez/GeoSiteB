const express = require("express");
const router = express.Router();
const cache = require("memory-cache");

const { getList, getCountryAndSites } = require("../services/list");
const { getById } = require("../services/byId");
const { getXmlInfo } = require("../services/utils");

const CACHE_DURATION = 36000000;

router.get("/xml", async (req, res) => {
  try {
    const xml = await getXmlInfo();
    return res.status(200).json(xml);
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.get("/list/:lang", async (req, res) => {
  try {
    const key = "__express__" + req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }

    const list = await getList(req.params.lang);
    cache.put(key, list, CACHE_DURATION);

    return res.status(200).json(list);
  } catch (error) {
    console.log(error);
    return res.status(500).json(error.message);
  }
});

router.get("/list/", async (req, res) => {
  try {
    const key = "__express__" + req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }

    const list = await getCountryAndSites(req.params.lang);
    cache.put(key, list, CACHE_DURATION);

    return res.status(200).json(list);
  } catch (error) {
    console.log(error);
    return res.status(500).json(error.message);
  }
});

router.get("/details/:id/:lang", async (req, res) => {
  try {
    const data = await getById(req.params.id, req.params.lang);

    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    return res.status(500).json(error.message);
  }
});

module.exports = router;
