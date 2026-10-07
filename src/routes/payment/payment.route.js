const router = require('express').Router();
const controller = require('../../controllers/payment/payment.controller');
const auth = require('../../middlewares/auth.middleware');
const validationSchema = require('../../validators/payment.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

// Protect all payment routes with auth middleware
router.use(auth());

router.post('/setup-intent', controller.createSetupIntent);

router.post(
  '/add-card',
  validator.body(validationSchema.attachCard),
  controller.attachCard,
);

router.get('/cards', controller.listCards);

router.post(
  '/set-default-card',
  validator.body(validationSchema.setDefaultCard),
  controller.setDefaultCard,
);

router.delete(
  '/cards/:paymentMethodId',
  validator.params(validationSchema.paymentMethodParams),
  controller.deleteCard,
);

router.get('/plans', controller.getServicePlans);
router.get('/my-plan', controller.getUserServicePlan);

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: Payment
 *     description: Payment and card management endpoints for Mobile
 */

/**
 * @swagger
 * /payment/setup-intent:
 *   post:
 *     summary: Create Stripe Setup Intent & Ephemeral Key for Mobile PaymentSheet
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Setup intent and ephemeral key generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Setup intent created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     setupIntent:
 *                       type: string
 *                       example: seti_1N..._secret_...
 *                     ephemeralKey:
 *                       type: string
 *                       example: ek_1N..._secret_...
 *                     customer:
 *                       type: string
 *                       example: cus_12345
 *                     publishableKey:
 *                       type: string
 *                       example: pk_test_...
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /payment/add-card:
 *   post:
 *     summary: Attach payment method (card) to user's Stripe customer
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 example: pm_1N...
 *               setAsDefault:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       200:
 *         description: Card attached successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /payment/cards:
 *   get:
 *     summary: Get user's saved payment methods (cards)
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved cards
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: pm_1N...
 *                       brand:
 *                         type: string
 *                         example: visa
 *                       last4:
 *                         type: string
 *                         example: 4242
 *                       expMonth:
 *                         type: number
 *                         example: 12
 *                       expYear:
 *                         type: number
 *                         example: 2028
 *                       funding:
 *                         type: string
 *                         example: credit
 *                       isDefault:
 *                         type: boolean
 *                         example: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /payment/set-default-card:
 *   post:
 *     summary: Set card as default payment method
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 example: pm_1N...
 *     responses:
 *       200:
 *         description: Default card set successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /payment/cards/{paymentMethodId}:
 *   delete:
 *     summary: Delete (detach) saved card
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *         example: pm_1N...
 *     responses:
 *       200:
 *         description: Card deleted successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /payment/plans:
 *   get:
 *     summary: Get available service plans (created in Admin Panel) for mobile
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of active subscription service plans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       tier:
 *                         type: string
 *                       description:
 *                         type: string
 *                       monthlyPrice:
 *                         type: number
 *                       yearlyPrice:
 *                         type: number
 *                       trialDays:
 *                         type: number
 *                       features:
 *                         type: array
 *                         items:
 *                           type: string
 *                       accessibleFeatures:
 *                         type: array
 *                       stripeMonthlyPriceId:
 *                         type: string
 *                       stripeYearlyPriceId:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /payment/my-plan:
 *   get:
 *     summary: Get logged-in user's active service plan and permissions
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User's active subscription tier, plan details, and feature permissions
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
