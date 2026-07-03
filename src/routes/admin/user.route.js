const router = require('express').Router();
const controller = require('../../controllers/admin/user.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSchema = require('../../validators/admin/user.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router.post(
  '/user-list/:page/:limit',
  validator.params(validationSchema.pagination),
  controller.listUser,
);

router.post(
  '/add-user',
  upload.single('profileimageurl'),
  validator.body(validationSchema.addUser),
  controller.addUser,
);

router.get(
  '/edit-user/:id',
  validator.params(validationSchema.singleId),
  controller.edituser,
);

router.patch(
  '/update-user/:id',
  upload.single('profileimageurl'),
  validator.body(validationSchema.updateuser),
  controller.updateUser,
);

router.delete(
  '/delete-user/:id',
  validator.params(validationSchema.singleId),
  controller.deleteUser,
);

router.patch(
  '/verification/:id',
  validator.params(validationSchema.singleId),
  controller.userVerification,
);

router.patch(
  '/block-unblock/:id',
  validator.params(validationSchema.singleId),
  controller.userBlockUnblock,
);

router.post(
  '/invitations/:id/:page/:limit',
  validator.params(validationSchema.singleUserId),
  controller.getInvitations,
);
module.exports = router;

/**
 * @swagger
 * tags:
 *   name: UserManagement
 *   description: User management operations for admins
 */

/**
 * @swagger
 * /admin/user-management/user-list/{page}/{limit}:
 *   post:
 *     summary: Get a list of users with pagination
 *     tags: [UserManagement]
 *     parameters:
 *       - in: path
 *         name: page
 *         required: true
 *         schema:
 *           type: string
 *           example: 1
 *         description: Page number for pagination
 *       - in: path
 *         name: limit
 *         required: true
 *         schema:
 *           type: string
 *           example: 10
 *         description: Number of users per page
 *       - in: body
 *         name: filter
 *         description: Filter to search users by role or name
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             search:
 *               type: string
 *               example: "John"
 *             role:
 *               type: string
 *               enum: [admin, model, seeker]
 *               example: "admin"
 *     responses:
 *       200:
 *         description: A list of users with pagination details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "user_id_example"
 *                       fullName:
 *                         type: string
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         example: "john.doe@example.com"
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 5
 *                 totalResults:
 *                   type: integer
 *                   example: 50
 *       400:
 *         description: Invalid pagination or filter
 *       404:
 *         description: No users found
 */

/**
 * @swagger
 * /admin/user-management/add-user:
 *   post:
 *     summary: Add a new user
 *     tags: [UserManagement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               role:
 *                 type: string
 *                 enum: [admin, model, seeker]
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Password123!"
 *               about:
 *                 type: object
 *                 properties:
 *                   age:
 *                     type: string
 *                     example: "30"
 *                   location:
 *                     type: string
 *                     example: "New York"
 *                   gender:
 *                     type: string
 *                     example: "Male"
 *                   interestedIn:
 *                     type: string
 *                     example: "Traveling"
 *     responses:
 *       200:
 *         description: User added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User added successfully"
 *                 userdata:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_id_example"
 *                     email:
 *                       type: string
 *                       example: "john.doe@example.com"
 *       400:
 *         description: Invalid user data
 */

/**
 * @swagger
 * /admin/user-management/edit-user/{id}:
 *   get:
 *     summary: Get a specific user's details by ID
 *     tags: [UserManagement]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "user_id_example"
 *         description: The ID of the user to retrieve
 *     responses:
 *       200:
 *         description: The user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "user_id_example"
 *                 fullName:
 *                   type: string
 *                   example: "John Doe"
 *                 email:
 *                   type: string
 *                   example: "john.doe@example.com"
 *                 role:
 *                   type: string
 *                   example: "admin"
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /admin/user-management/update-user/{id}:
 *   patch:
 *     summary: Update user details by ID
 *     tags: [UserManagement]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "user_id_example"
 *         description: The ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               role:
 *                 type: string
 *                 enum: [admin, model, seeker]
 *                 example: "admin"
 *               about:
 *                 type: object
 *                 properties:
 *                   age:
 *                     type: string
 *                     example: "30"
 *                   location:
 *                     type: string
 *                     example: "New York"
 *                   gender:
 *                     type: string
 *                     example: "Male"
 *                   interestedIn:
 *                     type: string
 *                     example: "Traveling"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User updated successfully"
 *                 userData:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_id_example"
 *                     fullName:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       example: "john.doe@example.com"
 *       400:
 *         description: Invalid user data
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /admin/user-management/delete-user/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     tags: [UserManagement]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "user_id_example"
 *         description: The ID of the user to delete
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
