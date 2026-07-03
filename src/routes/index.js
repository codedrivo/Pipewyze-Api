const router = require('express').Router();

const authRouter = require('./auth/auth.route');
const adminAuth = require('./admin/auth/auth.route');
const apprenticeRoute = require('./public/apprentice/apprentice.route');
const homeOwnerRoute = require('./public/home-owner/homeOwner.route');
const licensedPlumberRoute = require('./public/licensed-plumber/licensedPlumber.route');

// all routes
router.use('/auth', authRouter);

// all admin route
router.use('/admin', adminAuth);

// public role routes
router.use('/public/apprentice', apprenticeRoute);
router.use('/public/home-owner', homeOwnerRoute);
router.use('/public/licensed-plumber', licensedPlumberRoute);

module.exports = router;
