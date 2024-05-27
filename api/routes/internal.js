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
                        label: 'Focus ecosystems',
                        route: '/about',
                        queryParams: { section: 'focus-ecosystems' },
                    },
                ],
            },
            {
                id: 'our-organization',
                label: 'Our Organization',
                route: '/our-organization',
                children: [
                    {
                        route: '/our-organization',
                        label: 'Who We are?',
                        queryParams: { section: 'who-we-are' },
                    },
                    {
                        route: '/our-organization',
                        label: 'The organization',
                        queryParams: { section: 'the-organization' },
                    },
                    {
                        route: '/our-organization',
                        label: 'Laboratory partners',
                        queryParams: { section: 'lab-partners' },
                    },
                ],
            },
            {
                id: 'activities',
                label: 'Activities',
                route: '/activities',
                children: [
                    {
                        route: '/activities',
                        label: 'Survey Methods',
                        queryParams: { section: 'survey-methods' },
                    },
                    {
                        route: '/activities/',
                        label: 'Our transferable technology',
                        queryParams: { section: 'transferable-tech' },
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
                        label: 'Scientific collaborations and data',
                        queryParams: { section: 'collabs-and-data' },
                    },
                    {
                        route: '/resources',
                        label: 'Resources and publications',
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