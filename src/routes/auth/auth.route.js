const router = require('express').Router();
const validationSchema = require('../../validators/auth.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});
const controller = require('../../controllers/auth/auth.controller');

router.post(
  '/nofity-admin',
  validator.body(validationSchema.notifyAdmin),
  controller.notifyAdmin,
);

router.post(
  '/register',
  validator.body(validationSchema.register),
  controller.register,
);

router.post('/login', validator.body(validationSchema.login), controller.login);

router.post(
  '/logout',
  validator.body(validationSchema.logout),
  controller.logout,
);

router.post(
  '/refresh-tokens',
  validator.body(validationSchema.tokens),
  controller.refreshTokens,
);

router.post(
  '/forgot-password',
  validator.body(validationSchema.forgot),
  controller.forgotPassword,
);

router.post(
  '/send-email-otp',
  validator.body(validationSchema.forgot),
  controller.verifyEmailOTP,
);

router.post(
  '/send-phone-otp',
  validator.body(validationSchema.phoneVerify),
  controller.verifyPhoneOTP,
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

router.post(
  '/reset-password',
  validator.body(validationSchema.reset),
  controller.reset,
);

// router.post('/refresh-tokens', controller.refreshTokens); // Removed duplicate

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication
 */
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Registers a new user with their profile information and uploads a profile image.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: johndoe@example.com
 *               role:
 *                 type: string
 *                 description: User's role
 *                 enum: [admin, model, seeker]
 *                 example: seeker
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *                 example: P@ssw0rd!
 *               profileimageurl:
 *                 type: string
 *                 format: binary
 *                 description: Profile image file
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             example:
 *               message: "Registration successful, please verify your email"
 *               user:
 *                 id: "6405c8b789e763001ecfa02a"
 *                 fullName: "John Doe"
 *                 email: "johndoe@example.com"
 *                 role: "seeker"
 *                 profileimageurl: "https://example.com/uploads/profile.jpg"
 *                 createdAt: "2024-12-06T00:00:00.000Z"
 *                 updatedAt: "2024-12-06T00:00:00.000Z"
 *               tokens:
 *                 access: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               message: "Validation failed"
 *               errors:
 *                 fullName: "Full name is required"
 *                 email: "Invalid email format"
 *                 role: "Role must be one of admin, model, seeker"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               message: "An unexpected error occurred"
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     description: Logs in a user and returns authentication tokens.
 *     tags:
 *       - Auth
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
 *                 description: User's email address
 *                 example: johndoe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *                 example: P@ssw0rd!
 *               role:
 *                 type: string
 *                 description: User's role
 *                 enum: [home-owner, apprentice, licensed-plumber]
 *                 example: home-owner
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             example:
 *               message: "Login successful"
 *               tokens:
 *                 access: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               user:
 *                 id: "6405c8b789e763001ecfa02a"
 *                 fullName: "John Doe"
 *                 email: "johndoe@example.com"
 *                 role: "seeker"
 *                 profileimageurl: "https://example.com/uploads/profile.jpg"
 *                 createdAt: "2024-12-06T00:00:00.000Z"
 *                 updatedAt: "2024-12-06T00:00:00.000Z"
 *       400:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             example:
 *               message: "Invalid email or password"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               message: "An unexpected error occurred"
 */

/**
 * @swagger
 * /auth/refresh-tokens:
 *   post:
 *     summary: Refresh user authentication tokens
 *     description: Refreshes the user's authentication tokens using the provided refresh token.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: The refresh token used to obtain new access and refresh tokens.
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refresh successful
 *         content:
 *           application/json:
 *             example:
 *               message: "Token refresh successful"
 *               tokens:
 *                 access: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             example:
 *               message: "Invalid or expired token"
 *       403:
 *         description: Token verification failed
 *         content:
 *           application/json:
 *             example:
 *               message: "Token verification failed"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               message: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               message: "An unexpected error occurred"
 */

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Send OTP for password reset
 *     description: Sends a one-time password (OTP) to the user's email address for resetting their password.
 *     tags:
 *       - Auth
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
 *                 description: User's email address
 *                 example: johndoe@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "OTP sent to your email address"
 *       400:
 *         description: Invalid email format
 *         content:
 *           application/json:
 *             example:
 *               message: "Invalid email format"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               message: "User Not Found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               message: "Error in OTP generation"
 */

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP for password reset
 *     description: Resends a one-time password (OTP) to the user's email address for resetting their password.
 *     tags:
 *       - Auth
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
 *                 description: User's email address
 *                 example: johndoe@example.com
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "OTP sent to the email address"
 *       400:
 *         description: Invalid email format
 *         content:
 *           application/json:
 *             example:
 *               message: "Invalid email format"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               message: "User Not Found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               message: "Error in OTP generation"
 */

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP for password reset
 *     description: Verifies a one-time password (OTP) sent to the user's email address for password reset.
 *     tags:
 *       - Auth
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
 *                 description: User's email address
 *                 example: johndoe@example.com
 *               otp:
 *                 type: string
 *                 description: One-time password (OTP) to verify
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "OTP verified successfully"
 *       400:
 *         description: Invalid OTP format or incorrect OTP
 *         content:
 *           application/json:
 *             example:
 *               message: "Invalid OTP format or OTP does not match"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               message: "User Not Found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               message: "Error in OTP verification"
 */

/**
 * @swagger
 * /auth/reset-password:
 *   patch:
 *     summary: Reset user password
 *     description: Resets the user's password after verifying the OTP sent to their email address.
 *     tags:
 *       - Auth
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
 *                 description: User's email address
 *                 example: johndoe@example.com
 *               otp:
 *                 type: string
 *                 description: One-time password (OTP) to verify the reset request
 *                 example: "1234"
 *               password:
 *                 type: string
 *                 description: New password for the user
 *                 example: P@ssw0rd!
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "Password reset successful"
 *       400:
 *         description: Invalid or unverified OTP
 *         content:
 *           application/json:
 *             example:
 *               message: "Unverified or Invalid OTP"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               message: "User Not Found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               message: "Error resetting password"
 */
