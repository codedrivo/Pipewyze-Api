const router = require('express').Router();
const controller = require('../../controllers/profile/profile.controller');
const auth = require('../../middlewares/auth.middleware');
const validationSchema = require('../../validators/profile.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});
const upload = require('../../middlewares/multer.middleware');

router.use(auth());

router.get(
  '/get-user/:id',
  validator.params(validationSchema.singleId),
  controller.edituser,
);

router.get('/users-list', controller.listusers);

router.delete('/delete', controller.deleteAccount);

router.patch(
  '/change-password',
  validator.body(validationSchema.passchange),
  controller.passwordChange,
);

router.get('/', controller.getProfile);
router.get('/me', controller.getProfile);

router.patch(
  '/update',
  upload.single('profileimageurl'),
  controller.updateProfile,
);
router.patch(
  '/notification',
  validator.body(validationSchema.notificationToggle),
  controller.notificationToggle,
);

router.post(
  '/add-support',
  validator.body(validationSchema.support),
  controller.addSupport,
);

//router.get('/get-filter-types', filterController.getControllerUnickTypes);
//router.get('/get-filter-names/:type', filterController.getDataByType);

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: Profile
 *     description: Profile related operations
 */

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Get user profile details
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized, user needs to be logged in
 *       404:
 *         description: User profile not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier of the user
 *           example: 12345
 *         name:
 *           type: string
 *           description: The name of the user
 *           example: John Doe
 *         email:
 *           type: string
 *           description: The email of the user
 *           example: john.doe@example.com
 *         phone:
 *           type: string
 *           description: The phone number of the user
 *           example: +1234567890
 *         bio:
 *           type: string
 *           description: A brief description of the user
 *           example: Passionate about technology and innovation.
 *         profileimageurl:
 *           type: string
 *           description: The URL of the user's profile image
 *           example: http://example.com/profile-image.jpg
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *               example: 123 Main St
 *             city:
 *               type: string
 *               example: New York
 *             state:
 *               type: string
 *               example: NY
 *             zip:
 *               type: string
 *               example: 10001
 *         socialLinks:
 *           type: object
 *           properties:
 *             facebook:
 *               type: string
 *               example: https://facebook.com/johndoe
 *             twitter:
 *               type: string
 *               example: https://twitter.com/johndoe
 *             instagram:
 *               type: string
 *               example: https://instagram.com/johndoe
 */

/**
 * @swagger
 * /profile/update:
 *   patch:
 *     summary: Update user profile with image
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the user
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 description: The email address of the user
 *                 example: john.doe@example.com
 *               phone:
 *                 type: string
 *                 description: The phone number of the user
 *                 example: +1234567890
 *               bio:
 *                 type: string
 *                 description: A short biography of the user
 *                 example: Software developer with a passion for AI and machine learning.
 *               profileimageurl:
 *                 type: string
 *                 format: binary
 *                 description: Profile image file of the user
 *               address:
 *                 type: object
 *                 description: User's address information
 *                 properties:
 *                   street:
 *                     type: string
 *                     description: The street address
 *                     example: 123 Main St
 *                   city:
 *                     type: string
 *                     description: The city of the user
 *                     example: New York
 *                   state:
 *                     type: string
 *                     description: The state of the user
 *                     example: NY
 *                   zip:
 *                     type: string
 *                     description: The zip code of the user
 *                     example: 10001
 *               socialLinks:
 *                 type: object
 *                 description: Social media links of the user
 *                 properties:
 *                   facebook:
 *                     type: string
 *                     description: Facebook profile URL
 *                     example: https://facebook.com/johndoe
 *                   twitter:
 *                     type: string
 *                     description: Twitter profile URL
 *                     example: https://twitter.com/johndoe
 *                   instagram:
 *                     type: string
 *                     description: Instagram profile URL
 *                     example: https://instagram.com/johndoe
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Profile updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request, invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier of the user
 *           example: 12345
 *         name:
 *           type: string
 *           description: The name of the user
 *           example: John Doe
 *         email:
 *           type: string
 *           description: The email of the user
 *           example: john.doe@example.com
 *         phone:
 *           type: string
 *           description: The phone number of the user
 *           example: +1234567890
 *         bio:
 *           type: string
 *           description: A brief description of the user
 *           example: Passionate about technology and innovation.
 *         profileimageurl:
 *           type: string
 *           description: The URL of the user's profile image
 *           example: http://example.com/profile-image.jpg
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *               example: 123 Main St
 *             city:
 *               type: string
 *               example: New York
 *             state:
 *               type: string
 *               example: NY
 *             zip:
 *               type: string
 *               example: 10001
 *         socialLinks:
 *           type: object
 *           properties:
 *             facebook:
 *               type: string
 *               example: https://facebook.com/johndoe
 *             twitter:
 *               type: string
 *               example: https://twitter.com/johndoe
 *             instagram:
 *               type: string
 *               example: https://instagram.com/johndoe
 */

/**
 * @swagger
 * /profile/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password_old:
 *                 type: string
 *               password_new:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Invalid old password or passwords match
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/delete:
 *   delete:
 *     summary: Delete user account
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/notification:
 *   patch:
 *     summary: Update notification settings
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notification:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/add-support:
 *   post:
 *     summary: Add support request
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Support request added successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/add-intro-media:
 *   patch:
 *     summary: Add introduction media (images)
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               intromedia:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Media uploaded successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/delete-intro-media/{id}:
 *   delete:
 *     summary: Delete introduction media by ID
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Introduction media deleted successfully
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/add-private-media:
 *   post:
 *     summary: Add private media (single file)
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               privatemedia:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Private media added successfully
 *       400:
 *         description: Invalid file
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/delete-private-media/{id}:
 *   delete:
 *     summary: Delete private media by ID
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Private media deleted successfully
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/view-private-media/{id}:
 *   get:
 *     summary: View private media by user ID
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Private media found
 *       400:
 *         description: No private media found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/add-verification:
 *   patch:
 *     summary: Add verification (ID card and selfie)
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               idcardimage:
 *                 type: string
 *                 format: binary
 *               selfie:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Verification images added successfully
 *       400:
 *         description: Invalid images
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/social-links:
 *   patch:
 *     summary: Update social links (Facebook, Instagram, Twitter)
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               facebooklink:
 *                 type: string
 *               instagramlink:
 *                 type: string
 *               twitterlink:
 *                 type: string
 *     responses:
 *       200:
 *         description: Social links updated successfully
 *       400:
 *         description: Invalid social link data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
