const express = require("express");
const router = express.Router();
const cache = require("memory-cache");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config(); // Cargar variables de entorno desde .env

const { getList, getCountryAndSites } = require("../services/list");
const { getById } = require("../services/byId");
const { getXmlInfo } = require("../services/utils");

const CACHE_DURATION = Number(process.env.CACHE_DURATION);

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

router.post("/send-email", async (req, res) => {
  const { name, surname, email, message } = req.body;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // Servidor SMTP de Infomaniak
    port: Number(process.env.SMTP_PORT), // Usa 465 para SSL o 587 para STARTTLS
    secure: process.env.SMTP_SECURE === "true", // true para SSL (465), false para STARTTLS (587)
    auth: {
      user: process.env.SMTP_USER, // Tu correo en Infomaniak
      pass: process.env.SMTP_PASS, // La contraseña del correo
    },
    tls: {
      rejectUnauthorized: false, // Evita errores con certificados SSL/TLS
    },
  });

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: process.env.SMTP_CONTACT,
    subject: `${name} ${surname}`,
    text: `${message} email ${email}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error sending email" });
  }
});

module.exports = router;
