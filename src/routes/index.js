const router = require('express').Router();

const authRouter = require('./auth/auth.route');
const adminAuth = require('./admin/auth/auth.route');
const adminProfileRoute = require('./admin/profile.route');
const adminUserRoute = require('./admin/user.route');
const adminDashboardRoute = require('./admin/dashboard.route');
const adminSettingRoute = require('./admin/setting.route');
const adminPageRoute = require('./admin/page.route');
const profileRoute = require('./profile/profile.route');

const apprenticeRoute = require('./public/apprentice/apprentice.route');
const homeOwnerRoute = require('./public/home-owner/homeOwner.route');
const licensedPlumberRoute = require('./public/licensed-plumber/licensedPlumber.route');

// all routes
router.use('/auth', authRouter);

// all admin routes
router.use('/admin', adminAuth);
router.use('/admin/profile', adminProfileRoute);
router.use('/admin/user', adminUserRoute);
router.use('/admin/dashboard', adminDashboardRoute);
router.use('/admin/setting', adminSettingRoute);
router.use('/admin/page', adminPageRoute);

router.use('/profile', profileRoute);

// public role routes
router.use('/public/apprentice', apprenticeRoute);
router.use('/public/home-owner', homeOwnerRoute);
router.use('/public/licensed-plumber', licensedPlumberRoute);

module.exports = router;
