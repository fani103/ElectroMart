const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.EMAIL_FROM || 'ElectroMart <onboarding@resend.dev>';

module.exports = { resend, from };
