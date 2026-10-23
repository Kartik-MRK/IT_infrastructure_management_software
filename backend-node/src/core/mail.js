import nodemailer from 'nodemailer';
import config from './config.js';
import { getSupabase } from './database.js';

let transporter = null;
let mockMailSender = null;

export const setMockMailSender = (fn) => {
  mockMailSender = fn;
};

export const resetMailMocks = () => {
  mockMailSender = null;
};

export const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.SMTP_SERVER,
    port: config.SMTP_PORT,
    secure: config.SMTP_USE_SSL,
    auth: {
      user: config.SMTP_USERNAME,
      pass: config.SMTP_PASSWORD,
    },
  });

  return transporter;
};

/**
 * Send HTML and plaintext email alert for critical incidents
 */
export const sendCriticalIncidentEmail = async (incident, reporter) => {
  if (mockMailSender) {
    try {
      return await mockMailSender(incident, reporter);
    } catch {
      return false;
    }
  }

  try {
    if (!config.SMTP_USERNAME || !config.SMTP_PASSWORD) {
      console.log('⚠️ Email not configured. Skipping email alert.');
      return false;
    }

    if (!config.ADMIN_EMAIL) {
      console.log('⚠️ ADMIN_EMAIL not configured. Skipping email alert.');
      return false;
    }

    console.log(`📧 Sending CRITICAL INCIDENT EMAIL ALERT to: ${config.ADMIN_EMAIL}`);

    // Get asset info if available
    let assetInfo = 'N/A';
    if (incident.asset_id) {
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .table('assets')
          .select('name, type')
          .eq('id', incident.asset_id)
          .single();

        if (data) {
          assetInfo = `${data.name} (${data.type})`;
        }
      } catch {
        // ignore asset lookup error
      }
    }

    const title = incident.title || 'Unknown';
    const severity = String(incident.severity || '').toUpperCase();
    const priority = incident.priority !== undefined ? `${incident.priority}/10` : 'N/A';
    const status = String(incident.status || '').toUpperCase();
    const category = incident.category || 'Not specified';
    const description = incident.description || '';
    const reporterName = reporter?.full_name || 'N/A';
    const reporterEmail = reporter?.email || 'Unknown';
    const createdAt = incident.created_at || 'Just now';

    const plainText = `
CRITICAL INCIDENT ALERT - ITIMS
================================

A critical incident has been reported in the IT Infrastructure Management System.

INCIDENT DETAILS:
-----------------
Title:          ${title}
Severity:       ${severity}
Priority:       ${priority}
Status:         ${status}
Category:       ${category}

Description:
${description}

REPORTED BY:
------------
Name:           ${reporterName}
Email:          ${reporterEmail}

RELATED ASSET:
--------------
${assetInfo}

TIMESTAMP:
----------
Reported at:    ${createdAt}

ACTION REQUIRED:
----------------
This is a critical incident that requires immediate attention.
Please log in to the ITIMS dashboard to view and manage this incident.

Dashboard: http://localhost:5173/incidents

---
This is an automated message from ITIMS.
Do not reply to this email.
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; color: #1f2937; margin-bottom: 10px; border-bottom: 2px solid #dc2626; padding-bottom: 5px; }
        .info-row { margin: 5px 0; }
        .label { font-weight: bold; color: #4b5563; }
        .value { color: #1f2937; }
        .critical { color: #dc2626; font-weight: bold; }
        .description { background-color: white; padding: 15px; border-left: 4px solid #dc2626; margin: 10px 0; }
        .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 CRITICAL INCIDENT ALERT</h1>
            <p style="margin: 5px 0 0 0;">IT Infrastructure Management System</p>
        </div>
        
        <div class="content">
            <p>A <span class="critical">critical incident</span> has been reported and requires immediate attention.</p>
            
            <div class="section">
                <div class="section-title">INCIDENT DETAILS</div>
                <div class="info-row"><span class="label">Title:</span> <span class="value">${title}</span></div>
                <div class="info-row"><span class="label">Severity:</span> <span class="critical">${severity}</span></div>
                <div class="info-row"><span class="label">Priority:</span> <span class="value">${priority}</span></div>
                <div class="info-row"><span class="label">Status:</span> <span class="value">${status}</span></div>
                <div class="info-row"><span class="label">Category:</span> <span class="value">${category}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">DESCRIPTION</div>
                <div class="description">${description}</div>
            </div>
            
            <div class="section">
                <div class="section-title">REPORTED BY</div>
                <div class="info-row"><span class="label">Name:</span> <span class="value">${reporterName}</span></div>
                <div class="info-row"><span class="label">Email:</span> <span class="value">${reporterEmail}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">RELATED ASSET</div>
                <div class="value">${assetInfo}</div>
            </div>
            
            <div style="text-align: center;">
                <a href="http://localhost:5173/incidents" class="button">View Incident in Dashboard</a>
            </div>
        </div>
        
        <div class="footer">
            <p>This is an automated message from ITIMS.</p>
            <p>Do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
`;

    const client = getTransporter();
    await client.sendMail({
      from: config.SMTP_DEFAULT_SENDER,
      to: config.ADMIN_EMAIL,
      subject: `🚨 CRITICAL INCIDENT: ${title}`,
      text: plainText,
      html: htmlContent,
    });

    console.log(`✅ Email sent successfully to ${config.ADMIN_EMAIL}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to send email: ${error.message}`);
    return false;
  }
};
