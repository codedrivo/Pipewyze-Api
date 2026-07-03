const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/admin/page.controller');
const validationSchema = require('../../validators/admin/page.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router.post('/list/:page/:limit', controller.listPage);

router.post(
  '/add-page/',
  validator.body(validationSchema.page),
  controller.addPage,
);

router.get(
  '/view-page/:id',
  validator.params(validationSchema.singleId),
  controller.viewPage,
);

router.patch(
  '/update-page/:id',
  validator.body(validationSchema.page),
  validator.params(validationSchema.singleId),
  controller.updatePage,
);

router.delete(
  '/delete-page/:id',
  validator.params(validationSchema.singleId),
  controller.deletePage,
);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Admin Pages
 *   description: API for managing admin pages
 */

/**
 * @swagger
 * /admin/page/add-page/:
 *   post:
 *     summary: Add a new page
 *     tags: [Admin Pages]
 *     description: Allows an admin to add a new page with a title and description.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the page
 *               description:
 *                 type: string
 *                 description: Description of the page
 *             required:
 *               - title
 *               - description
 *     responses:
 *       200:
 *         description: Page added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid data provided
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /admin/page/view-page/{id}:
 *   get:
 *     summary: View a page by ID
 *     tags: [Admin Pages]
 *     description: Retrieve a specific page using its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pageData:
 *                   type: object
 *       404:
 *         description: Page not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /admin/page/update-page/{id}:
 *   patch:
 *     summary: Update an existing page
 *     tags: [Admin Pages]
 *     description: Update the title or description of a page by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Updated title of the page
 *               description:
 *                 type: string
 *                 description: Updated description of the page
 *             required:
 *               - title
 *               - description
 *     responses:
 *       200:
 *         description: Page updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 pageData:
 *                   type: object
 *       400:
 *         description: Invalid data provided
 *       404:
 *         description: Page not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /admin/page/delete-page/{id}:
 *   delete:
 *     summary: Delete a page by ID
 *     tags: [Admin Pages]
 *     description: Delete a specific page using its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page deleted successfully
 *       404:
 *         description: Page not found
 *       500:
 *         description: Internal server error
 */
