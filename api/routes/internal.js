const express = require('express');
const router = express.Router();

router.get('/menu', async (req, res) => {
    try {
        return res.status(200).json([
            {
                id: 'about',
                label: 'About',
                translate: 'MENU.ABOUT.ROOT',
                route: '/about',
                children: [
                    {
                        label: 'Our Vision',
                        translate: 'MENU.ABOUT.VISION',
                        route: '/about',
                        queryParams: { section: 'our-vision' },
                    },
                    {
                        label: 'Invest in Nature',
                        translate: 'MENU.ABOUT.INVEST',
                        route: '/about',
                        queryParams: { section: 'invest-in-nature' },
                    },
                    {
                        label: 'Ecosystems',
                        translate: 'MENU.ABOUT.ECOSYSTEMS',
                        route: '/about',
                        queryParams: { section: 'ecosystems' },
                    },
                    {
                        label: 'Metrics',
                        translate: 'MENU.ABOUT.METRICS',
                        route: '/about',
                        queryParams: { section: 'metrics' },
                    },
                ],
            },
            {
                id: 'community',
                label: 'Community',
                translate: 'MENU.COMMUNITY.ROOT',
                route: '/community',
                children: [
                    {
                        route: '/community',
                        translate: 'MENU.COMMUNITY.NETWORK',
                        label: 'The Network',
                        queryParams: { section: 'network' },
                    },
                    {
                        route: '/community',
                        translate: 'MENU.COMMUNITY.LABORATORIES',
                        label: 'Laboratories',
                        queryParams: { section: 'laboratories' },
                    },
                    {
                        route: '/community',
                        translate: 'MENU.COMMUNITY.FORUM',
                        label: 'Forum',
                        queryParams: { section: 'forum' },
                    },
                ],
            },
            {
                id: 'technology',
                label: 'Technology',
                translate: 'MENU.TECHNOLOGY.ROOT',
                route: '/technology',
                children: [
                    {
                        route: '/technology',
                        translate: 'MENU.TECHNOLOGY.EDNA',
                        label: 'eDNA',
                        queryParams: { section: 'edna' },
                    },
                    {
                        route: '/technology/',
                        translate: 'MENU.TECHNOLOGY.REMOTE_SENSING',
                        label: 'Remote sensing',
                        queryParams: { section: 'remote-sensing' },
                    },
                    {
                        route: '/technology',
                        translate: 'MENU.TECHNOLOGY.PROTOCOLS',
                        label: 'Protocols',
                        queryParams: { section: 'protocols' },
                    },
                    {
                        route: '/technology',
                        translate: 'MENU.TECHNOLOGY.BIOBANK',
                        label: 'Biobank',
                        queryParams: { section: 'biobank' },
                    },
                ],
            },
            {
                id: 'resources',
                label: 'Resources',
                translate: 'MENU.RESOURCES.ROOT',
                route: '/resources',
                children: [
                    {
                        route: '/resources',
                        translate: 'MENU.RESOURCES.DATA_SHARING',
                        label: 'Data sharing',
                        queryParams: { section: 'data-sharing' },
                    },
                    {
                        route: '/resources',
                        translate: 'MENU.RESOURCES.SINEWS',
                        label: 'Resources',
                        queryParams: { section: 'sinews' },
                    },
                    {
                        route: '/resources',
                        translate: 'MENU.RESOURCES.PUBLICATIONS',
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