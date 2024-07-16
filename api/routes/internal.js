const express = require('express');
const router = express.Router();

router.get('/menu', async (req, res) => {
    try {
        return res.status(200).json([
            {
                id: 'about',
                label: 'About',
                route: '/about',
                children: [
                    {
                        label: 'Our Vision',
                        route: '/about',
                        queryParams: { section: 'our-vision' },
                    },
                    {
                        label: 'Invest in Nature',
                        route: '/about',
                        queryParams: { section: 'invest-in-nature' },
                    },
                    {
                        label: 'Ecosystems',
                        route: '/about',
                        queryParams: { section: 'ecosystems' },
                    },
                    {
                        label: 'Metrics',
                        route: '/about',
                        queryParams: { section: 'metrics' },
                    },
                ],
            },
            {
                id: 'community',
                label: 'Community',
                route: '/community',
                children: [
                    {
                        route: '/community',
                        label: 'The Network',
                        queryParams: { section: 'network' },
                    },
                    {
                        route: '/community',
                        label: 'Laboratories',
                        queryParams: { section: 'laboratories' },
                    },
                    {
                        route: '/community',
                        label: 'Forum',
                        queryParams: { section: 'forum' },
                    },
                ],
            },
            {
                id: 'technology',
                label: 'Technology',
                route: '/technology',
                children: [
                    {
                        route: '/technology',
                        label: 'eDNA',
                        queryParams: { section: 'edna' },
                    },
                    {
                        route: '/technology/',
                        label: 'Remote sensing',
                        queryParams: { section: 'remote-sensing' },
                    },
                    {
                        route: '/technology',
                        label: 'Protocols',
                        queryParams: { section: 'protocols' },
                    },
                ],
            },
            {
                id: 'resources',
                label: 'Resources',
                route: '/resources',
                children: [
                    {
                        route: '/resources',
                        label: 'Data sharing',
                        queryParams: { section: 'data-sharing' },
                    },
                    {
                        route: '/resources',
                        label: 'Resources',
                        queryParams: { section: 'sinews' },
                    },
                    {
                        route: '/resources',
                        label: 'Publications',
                        queryParams: { section: 'publications' },
                    },
                ],
            },
        ]);
    } catch (e) {
        return res.status(500).json(error.message);
    }
});

module.exports = router;