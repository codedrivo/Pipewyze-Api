const router = require('express').Router();
const controller = require('../controllers/page.controller');
const validationSchema = require('../validators/page.validator');
const auth = require('../middlewares/auth.middleware');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.get('/page/:slug', controller.viewPages);

router.get('/general-settings', controller.ViewSettings);

router.post(
  '/save-contact',
  auth('user', true),
  validator.body(validationSchema.contactForm),
  controller.saveContact,
);

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: Page Module
 *     description: Operations related to page and FAQ management
 */

/**
 * @swagger
 * /page-module/page/{id}:
 *   get:
 *     summary: View a specific page by ID
 *     tags: [Page Module]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier for the page
 *     responses:
 *       200:
 *         description: Successfully retrieved the page details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pageDetails:
 *                   type: object
 *                   description: The details of the requested page
 *                   example:
 *                     title: "About Us"
 *                     content: "Welcome to our page!"
 *       400:
 *         description: Bad Request, invalid or missing parameters
 *       404:
 *         description: Page not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /page-module/faq:
 *   get:
 *     summary: Get the list of FAQ entries
 *     tags: [Page Module]
 *     responses:
 *       200:
 *         description: Successfully retrieved FAQ entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   question:
 *                     type: string
 *                     description: The question being asked in the FAQ
 *                     example: "What is your return policy?"
 *                   answer:
 *                     type: string
 *                     description: The answer to the FAQ question
 *                     example: "You can return products within 30 days."
 *       404:
 *         description: FAQ not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Page:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: The title of the page
 *           example: "About Us"
 *         content:
 *           type: string
 *           description: The content of the page
 *           example: "Welcome to our page!"
 *     Faq:
 *       type: object
 *       properties:
 *         question:
 *           type: string
 *           description: The question asked in the FAQ
 *           example: "What is your return policy?"
 *         answer:
 *           type: string
 *           description: The answer to the FAQ
 *           example: "You can return products within 30 days."
 */
