const router = require('express').Router();
const controller = require('../../../controllers/admin/auth.controller');
const validationSchema = require('../../../validators/auth.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.post(
  '/register',
  validator.body(validationSchema.register),
  controller.createAdmin,
);

router.post(
  '/login',
  validator.body(validationSchema.login),
  controller.adminLogin,
);

router.post(
  '/forgot-password',
  validator.body(validationSchema.forgot),
  controller.forgotPassword,
);

router.patch(
  '/reset-password',
  validator.body(validationSchema.resetAdmin),
  controller.reset,
);

router.post(
  '/resend-otp',
  validator.body(validationSchema.forgot),
  controller.forgotPasswordResend,
);

router.post(
  '/verify-otp',
  validator.body(validationSchema.verify),
  controller.verify,
);

router.post('/refresh-tokens', controller.refreshTokensAdmin);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: AdminAuth
 *   description: Admin authentication and management
 */

/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [AdminAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@1234
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: "access_token_example"
 *                     refreshToken:
 *                       type: string
 *                       example: "refresh_token_example"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_id_example"
 *                     email:
 *                       type: string
 *                       example: admin@example.com
 *                     role:
 *                       type: string
 *                       example: "admin"
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 *       401:
 *         description: Incorrect password
 */

/**
 * @swagger
 * /admin/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [AdminAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *     responses:
 *       200:
 *         description: OTP verification link sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: An OTP verification link has been sent to your email.
 *       404:
 *         description: User not found or not an admin
 */

/**
 * @swagger
 * /admin/reset-password:
 *   patch:
 *     summary: Reset password using OTP
 *     tags: [AdminAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               otp:
 *                 type: string
 *                 example: "1234"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@1234
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Password reset Successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /admin/resend-otp:
 *   post:
 *     summary: Resend OTP for password reset
 *     tags: [AdminAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *     responses:
 *       200:
 *         description: OTP sent to the email address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Otp Sent to the email address
 *       404:
 *         description: User not found or not an admin
 */

/**
 * @swagger
 * /admin/refresh-tokens:
 *   post:
 *     summary: Refresh access tokens
 *     tags: [AdminAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 example: "refresh_token_example"
 *     responses:
 *       200:
 *         description: Token refresh successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Token refresh successful
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: "access_token_example"
 *                     refreshToken:
 *                       type: string
 *                       example: "refresh_token_example"
 *       400:
 *         description: Invalid token
 *       404:
 *         description: User not found
 */
