const nodemailer = require('nodemailer');
const config = require('../../config/config');

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const { host, port, secure, user, pass } = config.email.smtp;

  if (!user || !pass) {
    console.warn(
      '[EMAIL] SMTP credentials are not configured. Falling back to console log email sending.',
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

const sendEmail = async (to, subject, text, html) => {
  const mailTransporter = getTransporter();
  const from =
    config.email.from || (config.email.smtp && config.email.smtp.user);

  if (!mailTransporter || !from) {
    console.log(
      `[DEV EMAIL LOG] (No SMTP Config) To: ${to} | Subject: ${subject} | Body: ${
        text || html
      }`,
    );
    return true;
  }

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL] Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
    // fallback to console log so it doesn't crash the server or process
    console.log(
      `[DEV EMAIL LOG] To: ${to} | Subject: ${subject} | Body: ${text || html}`,
    );
    return false;
  }
};

const sendTemplateEmail = async ({ to, subject, templateName, variables, replyTo }) => {
  let html = '';
  if (templateName === 'contact') {
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PipeWyze Contact Request</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <!-- Logo -->
              <tr>
                <td style="background:#ffffff;padding:20px;text-align:center;">
                  <img
                    src="https://pipewyze.com/logo-icon.png"
                    alt="PipeWyze"
                    width="140"
                    style="display:inline-block;border:0;max-width:140px;height:auto;"
                  />
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding:30px;color:#333;">
                  <p style="margin-top:0;">
                    A new contact request has been submitted through the <strong style="color:#335AFF;">PipeWyze</strong> platform. 
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background-color:rgba(51,90,255,0.06);border-radius:16px;">
                    <tr>
                      <td style="padding:20px;">
                        <p style="margin:0 0 12px;">
                          <strong>Name:</strong> ${variables.name || ''}
                        </p>

                        <p style="margin:0 0 12px;">
                          <strong>Email:</strong> ${variables.email || ''}
                        </p>

                        <p style="margin:0 0 12px;">
                          <strong>Phone:</strong> ${variables.phone || ''}
                        </p>

                        <p style="margin:0;">
                          <strong>Submitted On:</strong> ${variables.date || ''}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:24px;">
                    <p><strong>Message:</strong></p>

                    <div style="background-color:rgba(51,90,255,0.06);border-radius:16px;padding:16px;line-height:1.7;">
                      ${variables.message || ''}
                    </div>
                  </div>

                  <p style="margin-top:30px;">
                    Please review this inquiry and respond to the customer as soon as possible.
                  </p>

                  <p style="margin-top:30px;">
                    Thank you,<br>
                    <strong>PipeWyze Team</strong>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#ffffff;padding:20px;text-align:center;
                  color:#5C5C6F;font-size:13px;">
                  © 2026 PipeWyze. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
  </table>
</body>
</html>`;
  } else if (templateName === 'support-reply') {
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PipeWyze Support Reply</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <!-- Logo -->
              <tr>
                <td style="background:#ffffff;padding:20px;text-align:center;">
                  <img
                    src="https://pipewyze.com/logo-icon.png"
                    alt="PipeWyze"
                    width="140"
                    style="display:inline-block;border:0;max-width:140px;height:auto;"
                  />
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding:30px;color:#333;">
                  <p style="margin-top:0;">
                    Hello <strong>${variables.name || 'User'}</strong>,
                  </p>
                  
                  <p>
                    A support agent has responded to your inquiry on the <strong style="color:#335AFF;">PipeWyze</strong> platform.
                  </p>

                  <div style="margin-top:24px;">
                    <p style="margin-bottom:8px;"><strong>Support Reply:</strong></p>
                    <div style="background-color:rgba(51,90,255,0.06);border-radius:16px;padding:16px;line-height:1.7;border-left:4px solid #335AFF;">
                      ${variables.replyMessage || ''}
                    </div>
                  </div>

                  <div style="margin-top:24px;border-top:1px solid #eef2f6;padding-top:20px;">
                    <p style="margin-bottom:8px;color:#666;font-size:14px;"><strong>Your Original Message:</strong></p>
                    <div style="color:#666;font-size:14px;background-color:#fafafa;border-radius:16px;padding:16px;line-height:1.7;">
                      ${variables.message || ''}
                    </div>
                  </div>

                  <p style="margin-top:30px;">
                    Thank you,<br>
                    <strong>PipeWyze Team</strong>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#ffffff;padding:20px;text-align:center;
                  color:#5C5C6F;font-size:13px;">
                  © 2026 PipeWyze. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
  </table>
</body>
</html>`;
  } else {
    html = `<p>${JSON.stringify(variables)}</p>`;
  }

  const mailTransporter = getTransporter();
  const from = config.email.from || (config.email.smtp && config.email.smtp.user);

  if (!mailTransporter || !from) {
    console.log(
      `[DEV EMAIL LOG] (No SMTP Config) To: ${to} | Subject: ${subject} | Body: ${html}`,
    );
    return true;
  }

  const mailOptions = {
    from,
    to,
    subject,
    html,
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL] Template email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send template email to ${to}:`, error);
    console.log(
      `[DEV EMAIL LOG] To: ${to} | Subject: ${subject} | Body: ${html}`,
    );
    return false;
  }
};

module.exports = {
  sendEmail,
  sendTemplateEmail,
};
