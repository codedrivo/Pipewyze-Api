const router = require('express').Router();
const controller = require('../../controllers/admin/profile.controller');
const auth = require('../../middlewares/auth.middleware');
const validationSchema = require('../../validators/profile.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

const upload = require('../../middlewares/multer.middleware');

router.use(auth('admin'));

router.patch(
  '/image-update',
  upload.single('profileimageurl'),
  controller.updateProfileImage,
);

router.patch('/update', controller.updateProfile);

router.patch(
  '/change-password',
  validator.body(validationSchema.passchange),
  controller.passwordChange,
);
module.exports = router;

/**
 * @swagger
 * tags:
 *   name: AdminProfile
 *   description: Admin profile management
 */

/**
 * @swagger
 * /admin/profile/image-update:
 *   patch:
 *     summary: Update admin profile image
 *     tags: [AdminProfile]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profileimageurl:
 *                 type: string
 *                 format: binary
 *                 description: Profile image to upload
 *     responses:
 *       200:
 *         description: Profile image updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Profile image updated successfully
 *                 userData:
 *                   type: object
 *                   description: Updated user data
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_id_example"
 *                     email:
 *                       type: string
 *                       example: admin@example.com
 *                     profileimageurl:
 *                       type: string
 *                       example: "image_url_example"
 *       400:
 *         description: Invalid input or file format
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /admin/profile/update:
 *   patch:
 *     summary: Update admin profile information
 *     tags: [AdminProfile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
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
 *                 userData:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_id_example"
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /admin/profile/change-password:
 *   patch:
 *     summary: Change admin password
 *     tags: [AdminProfile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password_old:
 *                 type: string
 *                 format: password
 *                 example: OldPassword123
 *               password_new:
 *                 type: string
 *                 format: password
 *                 example: NewPassword@123
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Incorrect old password
 *       404:
 *         description: User not found
 */
