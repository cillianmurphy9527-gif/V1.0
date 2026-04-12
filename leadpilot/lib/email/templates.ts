/**
 * 商业级邮件模板库 — LeadPilot 外贸获客场景
 * 模板底部强制注入 RFC 8058 List-Unsubscribe 机制
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/** 通用 Unsubscribe 行（灰色 12px，符合 RFC 8058 / CAN-SPAM） */
function unsubscribeBlock(recipientEmail: string): string {
  const encoded = encodeURIComponent(recipientEmail)
  const href = `${BASE_URL}/api/unsubscribe?email=${encoded}`
  return `
  <tr>
    <td style="padding: 32px 40px 24px; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 12px; color: #999; line-height: 1.6; text-align: center;">
        If you no longer wish to receive these emails, you can
        <a href="${href}" style="color: #666; text-decoration: underline;" target="_blank" rel="noopener noreferrer">unsubscribe here</a>.
      </p>
    </td>
  </tr>`
}

/** 外贸开发信模板 — LeadPilot 平台邀请 */
export function buildLeadInviteEmail(opts: {
  recipientName: string
  recipientEmail: string
  inviterName?: string
  inviteLink?: string
}): { subject: string; html: string } {
  const { recipientName, recipientEmail, inviterName = 'LeadPilot Team', inviteLink = `${BASE_URL}/register` } = opts

  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>You've Been Invited to Join LeadPilot</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .wrapper { width: 100%; table-layout: fixed; }
    .outer { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 40px 40px 32px; text-align: center; }
    .logo { font-size: 22px; font-weight: 700; color: #38bdf8; letter-spacing: -0.5px; }
    .logo span { color: #ffffff; }
    .hero { background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%); padding: 48px 40px 40px; text-align: center; }
    .hero h1 { color: #ffffff; font-size: 26px; font-weight: 700; margin: 0 0 16px; line-height: 1.3; }
    .hero p  { color: #94a3b8; font-size: 15px; margin: 0; line-height: 1.6; }
    .content { padding: 40px 40px 8px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px 28px; margin-bottom: 28px; }
    .card-title { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 12px; }
    .card-text  { font-size: 15px; color: #1e293b; margin: 0; line-height: 1.7; }
    .feature-list { list-style: none; padding: 0; margin: 0 0 32px; }
    .feature-list li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; line-height: 1.5; }
    .feature-list li:last-child { border-bottom: none; }
    .feature-icon { flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-top: 1px; }
    .cta-wrap { text-align: center; padding: 8px 0 32px; }
    .cta { display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: 0.01em; }
    .cta:hover { background: linear-gradient(135deg, #1d4ed8, #1e40af); }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 0 40px 0; }
    .footer { padding: 0 40px 32px; }
    .footer-text { font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; }
    @media (max-width: 480px) {
      .header, .hero, .content, .footer { padding-left: 20px; padding-right: 20px; }
      .hero h1 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table class="outer" cellpadding="0" cellspacing="0" border="0">

            <!-- Header -->
            <tr>
              <td class="header">
                <div class="logo">Lead<span>Pilot</span></div>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td class="hero">
                <h1>You've Been Invited to<br/>Transform Your B2B Pipeline</h1>
                <p>${inviterName} thinks LeadPilot would be a great fit for your team.</p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td class="content">
                <p style="font-size: 15px; color: #334155; margin: 0 0 24px; line-height: 1.7;">
                  Hi ${recipientName || 'there'},
                </p>
                <p style="font-size: 15px; color: #334155; margin: 0 0 24px; line-height: 1.7;">
                  We help B2B sales teams and procurement professionals discover verified company intelligence — contact data, decision-maker maps, supply chain signals, and AI-powered outreach — all in one platform.
                </p>

                <!-- Feature bullets -->
                <ul class="feature-list">
                  <li>
                    <div class="feature-icon">✦</div>
                    <div><strong>Global Company Database</strong> — 120M+ business profiles across 180+ countries, with real-time data refresh.</div>
                  </li>
                  <li>
                    <div class="feature-icon">✦</div>
                    <div><strong>Decision-Maker Intelligence</strong> — Identify purchasing decision-makers, job titles, and LinkedIn signals automatically.</div>
                  </li>
                  <li>
                    <div class="feature-icon">✦</div>
                    <div><strong>AI Cold Email Composer</strong> — Generate personalized outreach sequences in one click, compliant with local regulations.</div>
                  </li>
                  <li>
                    <div class="feature-icon">✦</div>
                    <div><strong>Inbox & Lead Management</strong> — Track every reply, qualify leads by AI scoring, and manage your entire pipeline visually.</div>
                  </li>
                </ul>

                <div class="cta-wrap">
                  <a href="${inviteLink}" class="cta">Accept Invitation →</a>
                </div>
              </td>
            </tr>

            <!-- Divider + Unsubscribe -->
            <tr>
              <td>
                <hr class="divider" />
              </td>
            </tr>
            ${unsubscribeBlock(recipientEmail)}
            <!-- /Unsubscribe -->

            <!-- Footer -->
            <tr>
              <td class="footer">
                <p class="footer-text">
                  © ${new Date().getFullYear()} LeadPilot · Global B2B Intelligence Platform<br/>
                  This invitation was sent to ${recipientEmail}<br/>
                  <a href="${BASE_URL}" style="color: #94a3b8;">Visit LeadPilot</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`

  return {
    subject: `You've been invited — LeadPilot B2B Intelligence Platform`,
    html,
  }
}

/** 外贸供应链合作开发信模板 */
export function buildSupplyChainEmail(opts: {
  recipientName: string
  recipientEmail: string
  senderName?: string
  senderCompany?: string
}): { subject: string; html: string } {
  const { recipientName, recipientEmail, senderName = 'David Chen', senderCompany = 'LeadPilot International' } = opts

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Partnership Inquiry — Supply Chain Intelligence</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .wrapper { width: 100%; table-layout: fixed; }
    .outer { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #0f172a; padding: 32px 40px; display: flex; align-items: center; justify-content: space-between; }
    .brand { font-size: 18px; font-weight: 700; color: #38bdf8; }
    .badge { font-size: 11px; font-weight: 600; color: #10b981; background: #dcfce7; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.05em; }
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 40px; }
    .hero .tag { font-size: 11px; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; display: block; }
    .hero h1 { color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 16px; line-height: 1.3; }
    .hero p { color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.7; }
    .content { padding: 40px 40px 8px; }
    .greeting { font-size: 15px; color: #1e293b; margin: 0 0 20px; font-weight: 600; }
    .body-text { font-size: 14px; color: #475569; margin: 0 0 20px; line-height: 1.8; }
    .highlight-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0; }
    .highlight-box p { font-size: 14px; color: #166534; margin: 0; line-height: 1.7; }
    .highlight-box strong { color: #15803d; }
    .cta-wrap { text-align: center; padding: 8px 0 32px; }
    .cta { display: inline-block; background: #10b981; color: #ffffff; padding: 13px 32px; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 600; }
    .cta:hover { background: #059669; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 0 40px 0; }
    .footer { padding: 0 40px 32px; }
    .footer-text { font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; }
    @media (max-width: 480px) {
      .header, .hero, .content, .footer { padding-left: 20px; padding-right: 20px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table class="outer" cellpadding="0" cellspacing="0" border="0">
            <!-- Header -->
            <tr>
              <td class="header">
                <div class="brand">LeadPilot</div>
                <div class="badge">B2B Intelligence</div>
              </td>
            </tr>
            <!-- Hero -->
            <tr>
              <td class="hero">
                <span class="tag">Supply Chain Intelligence</span>
                <h1>Strengthen Your Global<br/>Supply Network Today</h1>
                <p>Exclusive partnership opportunity for verified suppliers and buyers across Southeast Asia &amp; Europe.</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td class="content">
                <p class="greeting">Dear ${recipientName || 'Valued Partner'},</p>
                <p class="body-text">
                  My name is ${senderName}, representing ${senderCompany}. We specialize in connecting international businesses with verified suppliers, procurement teams, and distribution channels across 180+ countries.
                </p>
                <p class="body-text">
                  We came across your company profile and believe there may be significant synergies between our networks, particularly in the following areas:
                </p>
                <div class="highlight-box">
                  <p><strong>✦ Smart Procurement Matching</strong><br/>Connect with 12,000+ verified manufacturers in Southeast Asia, matched by your exact product specs and compliance requirements.</p>
                </div>
                <div class="highlight-box">
                  <p><strong>✦ Real-Time Market Intelligence</strong><br/>Access live pricing trends, competitor benchmarks, and trade volume data for your target categories.</p>
                </div>
                <p class="body-text">
                  Would you be open to a 15-minute call next week to explore potential collaboration? I'm happy to work around your schedule.
                </p>
                <div class="cta-wrap">
                  <a href="${BASE_URL}/contact" class="cta">Schedule a Call →</a>
                </div>
                <p class="body-text" style="font-size: 13px; color: #94a3b8;">
                  Best regards,<br/><strong style="color: #475569;">${senderName}</strong><br/>
                  Business Development · ${senderCompany}<br/>
                  📧 reply@leadpilot.com
                </p>
              </td>
            </tr>
            <!-- Divider + Unsubscribe -->
            <tr>
              <td><hr class="divider" /></td>
            </tr>
            ${unsubscribeBlock(recipientEmail)}
            <!-- /Unsubscribe -->
            <!-- Footer -->
            <tr>
              <td class="footer">
                <p class="footer-text">
                  © ${new Date().getFullYear()} LeadPilot · Global B2B Intelligence Platform<br/>
                  Sent to ${recipientEmail}<br/>
                  <a href="${BASE_URL}" style="color: #94a3b8;">www.leadpilot.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`

  return {
    subject: `Partnership Inquiry — Global Supply Chain Intelligence | ${senderCompany}`,
    html,
  }
}
