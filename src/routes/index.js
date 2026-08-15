const router = require('express').Router();

const authRouter = require('./auth/auth.route');
const adminAuth = require('./admin/auth/auth.route');
const adminProfileRoute = require('./admin/profile.route');
const adminUserRoute = require('./admin/user.route');
const adminDashboardRoute = require('./admin/dashboard.route');
const adminSettingRoute = require('./admin/setting.route');
const adminPageRoute = require('./admin/page.route');
const adminEquipmentRoute = require('./admin/equipment.route');
const adminEquipmentCategoryRoute = require('./admin/equipmentCategory.route');
const adminEssentialToolRoute = require('./admin/essentialTool.route');
const adminPlumbingCodeRoute = require('./admin/plumbingCode.route');
const adminPlumbingCodeCategoryRoute = require('./admin/plumbingCodeCategory.route');
const adminMaintenanceGuideRoute = require('./admin/maintenanceGuide.route');
const adminTrendingVideoRoute = require('./admin/trendingVideo.route');
const adminFaqRoute = require('./admin/faq.route');
const adminSupportRoute = require('./admin/support.route');
const profileRoute = require('./profile/profile.route');
const pageRoute = require('./page.route');

const apprenticeRoute = require('./public/apprentice/apprentice.route');
const homeOwnerRoute = require('./public/home-owner/homeOwner.route');
const licensedPlumberRoute = require('./public/licensed-plumber/licensedPlumber.route');
const essentialToolPublicRoute = require('./public/essential-tool/essentialTool.route');
const plumbingCodePublicRoute = require('./public/plumbing-code/plumbingCode.route');
const savedResourceRoute = require('./public/saved-resource/savedResource.route');
const toolsLibraryRoute = require('./public/tools-library/toolsLibrary.route');
const trendingVideoPublicRoute = require('./public/trending-video/trendingVideo.route');
const faqPublicRoute = require('./public/faq/faq.route');

// all routes
router.use('/auth', authRouter);

// all admin routes
router.use('/admin', adminAuth);
router.use('/admin/profile', adminProfileRoute);
router.use('/admin/user', adminUserRoute);
router.use('/admin/dashboard', adminDashboardRoute);
router.use('/admin/setting', adminSettingRoute);
router.use('/admin/page', adminPageRoute);
router.use('/admin/equipment', adminEquipmentRoute);
router.use('/admin/equipment-category', adminEquipmentCategoryRoute);
router.use('/admin/essential-tool', adminEssentialToolRoute);
router.use('/admin/plumbing-code', adminPlumbingCodeRoute);
router.use('/admin/plumbing-code-category', adminPlumbingCodeCategoryRoute);
router.use('/admin/maintenance-guide', adminMaintenanceGuideRoute);
router.use('/admin/trending-video', adminTrendingVideoRoute);
router.use('/admin/faq', adminFaqRoute);
router.use('/admin/support', adminSupportRoute);
router.use('/', pageRoute);

router.use('/profile', profileRoute);

// public role routes
router.use('/public/apprentice', apprenticeRoute);
router.use('/public/home-owner', homeOwnerRoute);
router.use('/public/licensed-plumber', licensedPlumberRoute);
router.use('/public/essential-tools', essentialToolPublicRoute);
router.use('/public/plumbing-codes', plumbingCodePublicRoute);
router.use('/public/saved-resources', savedResourceRoute);
router.use('/public/tools-library', toolsLibraryRoute);
router.use('/public/trending-videos', trendingVideoPublicRoute);
router.use('/public/faq', faqPublicRoute);

module.exports = router;
