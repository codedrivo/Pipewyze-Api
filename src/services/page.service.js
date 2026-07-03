const ApiError = require('../helpers/apiErrorConverter');
const Page = require('../models/page.model');
const Settings = require('../models/setting.model');
const Support = require('../models/support.model');
const config = require('../config/config');
const emailService = require('./email/email.service');

const viewPage = async (slug) => {
  try {
    const result = await Page.findOne({ slug: slug });
    if (!result) {
      throw new ApiError('Data not found', 404);
    }
    return result;
  } catch (e) {
    throw new ApiError(e.message, 500);
  }
};

const viewSettings = async () => {
  const result = await Settings.findOne().select(
    'bannerLeftPersonImage bannerRightPersonImage bannerLeftPersonEvent bannerLeftPersonName bannerRightPersonName bannerRightPersonEvent -_id',
  );
  if (result.length === 0) {
    throw new ApiError('Data not found', 404);
  }
  return result;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeContactData = (contactData = {}) => {
  const firstName = String(
    contactData.firstName || contactData.firstname || contactData.name || '',
  ).trim();
  const lastName = String(
    contactData.lastName || contactData.lastname || '',
  ).trim();
  const email = String(contactData.email || '').trim();
  const phone = String(
    contactData.phone || contactData.phoneNumber || contactData.mobile || '',
  ).trim();
  const message = String(
    contactData.message ||
      contactData.description ||
      contactData.content ||
      contactData.details ||
      '',
  ).trim();

  return {
    ...contactData,
    firstName,
    lastName,
    email,
    phone,
    message,
  };
};

const buildContactHtml = ({ firstName, lastName, email, phone, message }) => {
  const fullName = `${firstName} ${lastName}`.trim();
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
    </div>
  `;
};

const saveContact = async (contactData) => {

  try {
    const normalized = normalizeContactData(contactData);


    const settings = await Settings.findOne().select('adminEmail -_id');


    const recipient = settings?.adminEmail || config.email.from;


    if (!recipient) {

      throw new ApiError('Support email is not configured', 500);
    }

    const subject =
      'New contact request from ' +
      (normalized.firstName || 'Guest') +
      (normalized.lastName ? ` ${normalized.lastName}` : '');

    const moment = require('moment');
    const submittedOn = moment().format('MM/DD/YYYY');


    try {
      await emailService.sendTemplateEmail({
        to: recipient,
        subject,
        templateName: 'contact',
        variables: {
          name: `${normalized.firstName || ''} ${normalized.lastName || ''}`.trim() || 'Guest',
          email: normalized.email,
          phone: normalized.phone,
          date: submittedOn,
          message: normalized.message,
        },
        replyTo: normalized.email,
      });

    } catch (emailError) {

      throw emailError;
    }


    try {
      const supportTicket = await Support.create({
        userId: normalized.userId || null,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        email: normalized.email,
        phone: normalized.phone,
        subject,
        message: normalized.message,
        status: 'open',
      });

    } catch (dbError) {

      throw dbError;
    }

    return {
      sentTo: recipient,
      message: 'Contact form submitted successfully',
    };
  } catch (error) {

    throw error;
  }
};

module.exports = {
  viewPage,
  viewSettings,
  saveContact,
};
