const router = require('express').Router();
const controller = require('../../controllers/admin/faq.controller');
const auth = require('../../middlewares/auth.middleware');
const validationSchema = require('../../validators/admin/faq.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router.post(
  '/faq-list/:page/:limit',
  validator.params(validationSchema.pagination),
  controller.listFaq,
);

router.get(
  '/faq-detail/:id',
  validator.params(validationSchema.singleId),
  controller.getFaq,
);

router.post(
  '/add-faq',
  validator.body(validationSchema.createFaq),
  controller.createFaq,
);

router.patch(
  '/update-faq/:id',
  validator.params(validationSchema.singleId),
  validator.body(validationSchema.updateFaq),
  controller.updateFaq,
);

router.delete(
  '/remove-faq/:id',
  validator.params(validationSchema.singleId),
  controller.deleteFaq,
);

module.exports = router;
